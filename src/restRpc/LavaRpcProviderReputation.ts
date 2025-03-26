import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/LavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';
import { ProviderStakesAndDelegationService } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';

const REDIS_KEYS = {
    PROVIDER_REPUTATION_PREFIX: 'provider_reputation_',
    PROVIDER_REPUTATION_DETAILS_PREFIX: 'provider_reputation_details_',
    PROVIDER_PAIRING_CHANCE_PREFIX: 'provider_pairing_chance_',
    PROVIDER_REPUTATION_STATS: 'provider_reputation_stats',
    ALL_PROVIDER_REPUTATION_METRICS: 'all_provider_reputation_metrics',
} as const;

interface ProviderReputationResponse {
    data: ProviderReputation[];
}

interface ProviderReputation {
    rank: string;
    providers: string;
    overall_performance: string;
    chainID: string;
    cluster: string;
}

interface ProviderReputationDetailsResponse {
    data: ProviderReputationDetails[];
}

interface ProviderReputationDetails {
    reputation: {
        score: {
            score: {
                num: string;
                denom: string;
            };
            variance: {
                num: string;
                denom: string;
            };
        };
        epoch_score: {
            score: {
                num: string;
                denom: string;
            };
            variance: {
                num: string;
                denom: string;
            };
        };
        time_last_updated: string;
        creation_time: string;
        stake: {
            denom: string;
            amount: string;
        };
    };
    reputation_pairing_score: {
        score: string;
    };
    chainID: string;
    cluster: string;
}

interface ProviderPairingChanceResponse {
    chance: string;
}
// Update the ProviderReputationMetrics interface to use a consistent structure
interface MetricStats {
    sum: number;
    count: number;
    min: number;
    max: number;
}

interface ProviderReputationMetrics {
    genericScore: MetricStats;
    relativePlacement: MetricStats;
    pairingScore: MetricStats;
    pairingChance: MetricStats;
    chainID: string;
    timestamp: string; // Changed to string for UTC date
}

interface ProviderReputationStats {
    genericScore: MetricStats;
    relativePlacement: MetricStats;
    pairingScore: MetricStats;
    pairingChance: MetricStats;
    lastUpdated: string; // Changed to string for UTC date
}

class LavaRpcProviderReputationClass {
    private cacheRefreshInterval = 15 * 60; // 15 minutes
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.cacheRefreshInterval * 1000);
    }

    // Add the missing getCurrentUTCDateString method
    private getCurrentUTCDateString(): string {
        return new Date().toISOString();
    }

    private async refreshCache(): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this._refreshCache()
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    }

    // Keep only one implementation of _refreshCache
    private async _refreshCache(): Promise<void> {
        try {
            // Get provider stakes data which includes chains per provider
            const providerStakesData = await ProviderStakesAndDelegationService.fetch();
            const allMetrics: ProviderReputationMetrics[] = [];
            const providerMetricsMap: Record<string, ProviderReputationMetrics[]> = {};

            if (providerStakesData && providerStakesData.detailedProviderStakes) {
                // Process providers in parallel
                await this.processAllProviders(providerStakesData.detailedProviderStakes, providerMetricsMap);
            }

            // Store all metrics in Redis for quick retrieval
            await RedisCache.setDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS, providerMetricsMap, this.cacheRefreshInterval);

            logger.info(`Refreshed reputation data for ${allMetrics.length} provider-chain combinations`);
        } catch (error) {
            logger.error('Error refreshing provider reputation cache', { error: TruncateError(error) });
        }
    }

    // Process all providers and collect metrics
    private async processAllProviders(
        detailedProviderStakes: Record<string, any[]>,
        providerMetricsMap: Record<string, ProviderReputationMetrics[]>
    ): Promise<void> {
        const providerPromises: Promise<void>[] = [];

        for (const provider in detailedProviderStakes) {
            providerMetricsMap[provider] = [];

            // Get the chains this provider is staked on
            const providerStakes = detailedProviderStakes[provider];

            if (!providerStakes || providerStakes.length === 0) {
                logger.debug(`No stakes found for provider ${provider}, skipping reputation fetch`);
                continue;
            }

            // Extract unique chain IDs from provider stakes
            const chainIDs = [...new Set(providerStakes.map(stake => stake.specId))];

            // Create a promise for processing this provider
            const providerPromise = this.processProviderChains(provider, chainIDs, providerMetricsMap);
            providerPromises.push(providerPromise);
        }

        // Wait for all providers to be processed
        await Promise.all(providerPromises);
    }

    // Process all chains for a single provider
    private async processProviderChains(
        provider: string,
        chainIDs: string[],
        providerMetricsMap: Record<string, ProviderReputationMetrics[]>
    ): Promise<void> {
        // Process each chain for this provider
        const providerChainMetrics: ProviderReputationMetrics[] = [];

        // Process chains in parallel for this provider
        const chainPromises = chainIDs.map(async (chainID) => {
            try {
                const metrics = await this.fetchProviderReputationMetrics(provider, chainID);
                if (metrics) {
                    providerChainMetrics.push(metrics);
                }
            } catch (error) {
                logger.warn(`Failed to fetch reputation for provider ${provider} on chain ${chainID}`, {
                    error: TruncateError(error)
                });
            }
        });

        // Wait for all chain metrics to be fetched
        await Promise.all(chainPromises);

        // Add metrics to the provider's array
        providerMetricsMap[provider] = providerChainMetrics;
    }

    private async fetchProviderReputationMetrics(provider: string, chainID: string): Promise<ProviderReputationMetrics | null> {
        try {
            const encodedProvider = encodeURIComponent(provider);
            const reputationCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_PREFIX}${provider}_${chainID}`;
            const detailsCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_DETAILS_PREFIX}${provider}_${chainID}`;
            const pairingChanceCacheKey = `${REDIS_KEYS.PROVIDER_PAIRING_CHANCE_PREFIX}${provider}_${chainID}`;
            const allMetricsKey = `${REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS}${provider}_${chainID}`;

            // Fetch reputation data
            let reputationResponse: ProviderReputationResponse;
            try {
                reputationResponse = await QueryLavaRPC<ProviderReputationResponse>(
                    `/lavanet/lava/pairing/provider_reputation/${encodedProvider}/${chainID}/*`
                );
                await RedisCache.setDict(reputationCacheKey, reputationResponse, this.cacheRefreshInterval);
            } catch (error) {
                return null;
            }

            // Fetch reputation details
            let detailsResponse: ProviderReputationDetailsResponse;
            try {
                detailsResponse = await QueryLavaRPC<ProviderReputationDetailsResponse>(
                    `/lavanet/lava/pairing/provider_reputation_details/${encodedProvider}/${chainID}/*`
                );
                await RedisCache.setDict(detailsCacheKey, detailsResponse, this.cacheRefreshInterval);
            } catch (error) {
                return null;
            }

            // Fetch pairing chance (using gateway_0 as default cluster)
            let pairingChanceResponse: ProviderPairingChanceResponse;
            try {
                pairingChanceResponse = await QueryLavaRPC<ProviderPairingChanceResponse>(
                    `/lavanet/lava/pairing/provider_pairing_chance/${encodedProvider}/${chainID}/65535/gateway_0`
                );
                await RedisCache.setDict(pairingChanceCacheKey, pairingChanceResponse, this.cacheRefreshInterval);
            } catch (error) {
                return null;
            }

            if (reputationResponse.data.length === 0 || detailsResponse.data.length === 0) {
                return null;
            }

            const reputation = reputationResponse.data[0];
            const details = detailsResponse.data[0];

            // Calculate metrics
            const genericScoreValue = this.calculateGenericScore(details.reputation.score.score);
            const relativePlacementValue = this.calculateRelativePlacement(reputation);
            const pairingScoreValue = parseFloat(details.reputation_pairing_score.score);
            const pairingChanceValue = parseFloat(pairingChanceResponse.chance);

            // Check if previous metrics exist in Redis and aggregate if they do
            const existingMetric = await RedisCache.getDict(allMetricsKey) as ProviderReputationMetrics | undefined;

            // Create new metrics, aggregating with existing data if available
            const metrics: ProviderReputationMetrics = {
                genericScore: this.createAggregatedMetricStats(
                    genericScoreValue,
                    existingMetric?.genericScore
                ),
                relativePlacement: this.createAggregatedMetricStats(
                    relativePlacementValue,
                    existingMetric?.relativePlacement
                ),
                pairingScore: this.createAggregatedMetricStats(
                    pairingScoreValue,
                    existingMetric?.pairingScore
                ),
                pairingChance: this.createAggregatedMetricStats(
                    pairingChanceValue,
                    existingMetric?.pairingChance
                ),
                chainID: reputation.chainID,
                timestamp: this.getCurrentUTCDateString()
            };

            return metrics;
        } catch (error) {
            // Fix TypeScript error here too
            logger.error(`Error fetching reputation metrics for provider ${provider} on chain ${chainID}`, {
                error: TruncateError(error instanceof Error ? error : String(error))
            });
            return null;
        }
    }

    // Helper method to create aggregated metric stats
    private createAggregatedMetricStats(newValue: number, existingStats?: MetricStats): MetricStats {
        if (!existingStats) {
            return {
                sum: newValue,
                count: 1,
                min: newValue,
                max: newValue
            };
        }

        // Aggregate with existing stats
        return {
            sum: existingStats.sum + newValue,
            count: existingStats.count + 1,
            min: Math.min(existingStats.min, newValue),
            max: Math.max(existingStats.max, newValue)
        };
    }

    private calculateGenericScore(score: { num: string; denom: string }): number {
        const num = parseFloat(score.num);
        const denom = parseFloat(score.denom);
        return denom === 0 ? 0 : num / denom;
    }

    private calculateRelativePlacement(reputation: ProviderReputation): number {
        const rank = parseInt(reputation.rank);
        const providers = parseInt(reputation.providers);
        return providers === 0 ? 0 : rank / providers;
    }

    // Update the GetAllProviderReputationData method to remove the stats object
    public async GetAllProviderReputationData(): Promise<{
        providers: Record<string, ProviderReputationMetrics[]>;
    }> {
        const metricsData = await RedisCache.getDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS) as Record<string, ProviderReputationMetrics[]>;

        if (!metricsData) {
            await this.refreshCache();
            const refreshedMetrics = await RedisCache.getDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS) as Record<string, ProviderReputationMetrics[]> || {};

            return {
                providers: refreshedMetrics
            };
        }

        return {
            providers: metricsData
        };
    }

}

export const LavaRpcProviderReputation = new LavaRpcProviderReputationClass();

