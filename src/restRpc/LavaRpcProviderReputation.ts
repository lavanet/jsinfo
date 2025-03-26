import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/LavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';
import { ProviderStakesAndDelegationResource } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';

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

interface ProviderReputationMetrics {
    genericScore: number;
    relativePlacement: number;
    pairingScore: number;
    pairingChance: number;
    chainID: string;
    cluster: string;
    timestamp: number;
}

interface ProviderReputationStats {
    genericScore: {
        sum: number;
        count: number;
        min: number;
        max: number;
    };
    relativePlacement: {
        sum: number;
        count: number;
        min: number;
        max: number;
    };
    pairingScore: {
        sum: number;
        count: number;
        min: number;
        max: number;
    };
    pairingChance: {
        sum: number;
        count: number;
        min: number;
        max: number;
    };
    lastUpdated: number;
}

class LavaRpcProviderReputationClass {
    private cacheRefreshInterval = 15 * 60; // 15 minutes
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.cacheRefreshInterval * 1000);
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

    private async _refreshCache(): Promise<void> {
        try {
            const providers = await RpcPeriodicEndpointCache.GetAllProvidersFromRpc();

            // Get provider stakes data which includes chains per provider
            const providerStakesData = await ProviderStakesAndDelegationResource.fetch();

            const allMetrics: ProviderReputationMetrics[] = [];
            const providerMetricsMap: Record<string, ProviderReputationMetrics[]> = {};

            if (providerStakesData && providerStakesData.detailedProviderStakes) {
                for (const provider of providers) {
                    providerMetricsMap[provider] = [];

                    // Get the chains this provider is staked on
                    const providerStakes = providerStakesData.detailedProviderStakes[provider];

                    if (!providerStakes || providerStakes.length === 0) {
                        logger.debug(`No stakes found for provider ${provider}, skipping reputation fetch`);
                        continue;
                    }

                    // Extract unique chain IDs from provider stakes
                    const chainIDs = [...new Set(providerStakes.map(stake => stake.specId))];

                    for (const chainID of chainIDs) {
                        try {
                            const metrics = await this.fetchProviderReputationMetrics(provider, chainID);
                            if (metrics) {
                                allMetrics.push(metrics);
                                providerMetricsMap[provider].push(metrics);
                            }
                        } catch (error) {
                            logger.warn(`Failed to fetch reputation for provider ${provider} on chain ${chainID}`, {
                                error: TruncateError(error)
                            });
                        }
                    }
                }
            }

            // Store all metrics in Redis for quick retrieval
            await RedisCache.setDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS, providerMetricsMap, this.cacheRefreshInterval);

            await this.updateReputationStats(allMetrics);
            logger.info(`Refreshed reputation data for ${allMetrics.length} provider-chain combinations`);
        } catch (error) {
            logger.error('Error refreshing provider reputation cache', { error: TruncateError(error) });
        }
    }

    private async fetchProviderReputationMetrics(provider: string, chainID: string): Promise<ProviderReputationMetrics | null> {
        try {
            const encodedProvider = encodeURIComponent(provider);
            const reputationCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_PREFIX}${provider}_${chainID}`;
            const detailsCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_DETAILS_PREFIX}${provider}_${chainID}`;
            const pairingChanceCacheKey = `${REDIS_KEYS.PROVIDER_PAIRING_CHANCE_PREFIX}${provider}_${chainID}`;

            // Fetch reputation data
            const reputationResponse = await QueryLavaRPC<ProviderReputationResponse>(
                `/lavanet/lava/pairing/provider_reputation/${encodedProvider}/${chainID}/*`
            );
            await RedisCache.setDict(reputationCacheKey, reputationResponse, this.cacheRefreshInterval);

            // Fetch reputation details
            const detailsResponse = await QueryLavaRPC<ProviderReputationDetailsResponse>(
                `/lavanet/lava/pairing/provider_reputation_details/${encodedProvider}/${chainID}/*`
            );
            await RedisCache.setDict(detailsCacheKey, detailsResponse, this.cacheRefreshInterval);

            // Fetch pairing chance (using gateway_0 as default cluster)
            const pairingChanceResponse = await QueryLavaRPC<ProviderPairingChanceResponse>(
                `/lavanet/lava/pairing/provider_pairing_chance/${encodedProvider}/${chainID}/65535/gateway_0`
            );
            await RedisCache.setDict(pairingChanceCacheKey, pairingChanceResponse, this.cacheRefreshInterval);

            if (reputationResponse.data.length === 0 || detailsResponse.data.length === 0) {
                logger.debug(`No reputation data found for provider ${provider} on chain ${chainID}`);
                return null;
            }

            const reputation = reputationResponse.data[0];
            const details = detailsResponse.data[0];

            // Calculate metrics
            const genericScore = this.calculateGenericScore(details.reputation.score.score);
            const relativePlacement = this.calculateRelativePlacement(reputation);
            const pairingScore = parseFloat(details.reputation_pairing_score.score);
            const pairingChance = parseFloat(pairingChanceResponse.chance);

            const metrics: ProviderReputationMetrics = {
                genericScore,
                relativePlacement,
                pairingScore,
                pairingChance,
                chainID: reputation.chainID,
                cluster: reputation.cluster,
                timestamp: Math.floor(Date.now() / 1000)
            };

            return metrics;
        } catch (error) {
            logger.error(`Error fetching reputation metrics for provider ${provider} on chain ${chainID}`, {
                error: TruncateError(error)
            });
            return null;
        }
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

    private async updateReputationStats(metrics: ProviderReputationMetrics[]): Promise<void> {
        if (metrics.length === 0) {
            return;
        }

        const stats: ProviderReputationStats = {
            genericScore: { sum: 0, count: 0, min: Infinity, max: -Infinity },
            relativePlacement: { sum: 0, count: 0, min: Infinity, max: -Infinity },
            pairingScore: { sum: 0, count: 0, min: Infinity, max: -Infinity },
            pairingChance: { sum: 0, count: 0, min: Infinity, max: -Infinity },
            lastUpdated: Math.floor(Date.now() / 1000)
        };

        for (const metric of metrics) {
            // Update genericScore stats
            stats.genericScore.sum += metric.genericScore;
            stats.genericScore.count++;
            stats.genericScore.min = Math.min(stats.genericScore.min, metric.genericScore);
            stats.genericScore.max = Math.max(stats.genericScore.max, metric.genericScore);

            // Update relativePlacement stats
            stats.relativePlacement.sum += metric.relativePlacement;
            stats.relativePlacement.count++;
            stats.relativePlacement.min = Math.min(stats.relativePlacement.min, metric.relativePlacement);
            stats.relativePlacement.max = Math.max(stats.relativePlacement.max, metric.relativePlacement);

            // Update pairingScore stats
            stats.pairingScore.sum += metric.pairingScore;
            stats.pairingScore.count++;
            stats.pairingScore.min = Math.min(stats.pairingScore.min, metric.pairingScore);
            stats.pairingScore.max = Math.max(stats.pairingScore.max, metric.pairingScore);

            // Update pairingChance stats
            stats.pairingChance.sum += metric.pairingChance;
            stats.pairingChance.count++;
            stats.pairingChance.min = Math.min(stats.pairingChance.min, metric.pairingChance);
            stats.pairingChance.max = Math.max(stats.pairingChance.max, metric.pairingChance);
        }

        // Fix min values if they're still at Infinity (no data)
        if (stats.genericScore.min === Infinity) stats.genericScore.min = 0;
        if (stats.relativePlacement.min === Infinity) stats.relativePlacement.min = 0;
        if (stats.pairingScore.min === Infinity) stats.pairingScore.min = 0;
        if (stats.pairingChance.min === Infinity) stats.pairingChance.min = 0;

        await RedisCache.setDict(REDIS_KEYS.PROVIDER_REPUTATION_STATS, stats, this.cacheRefreshInterval);
    }

    public async GetProviderReputationMetrics(provider: string, chainID: string): Promise<ProviderReputationMetrics | null> {
        const reputationCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_PREFIX}${provider}_${chainID}`;
        const detailsCacheKey = `${REDIS_KEYS.PROVIDER_REPUTATION_DETAILS_PREFIX}${provider}_${chainID}`;
        const pairingChanceCacheKey = `${REDIS_KEYS.PROVIDER_PAIRING_CHANCE_PREFIX}${provider}_${chainID}`;

        const reputationData = await RedisCache.getDict(reputationCacheKey) as ProviderReputationResponse;
        const detailsData = await RedisCache.getDict(detailsCacheKey) as ProviderReputationDetailsResponse;
        const pairingChanceData = await RedisCache.getDict(pairingChanceCacheKey) as ProviderPairingChanceResponse;

        if (!reputationData || !detailsData || !pairingChanceData) {
            await this.refreshCache();
            return null;
        }

        if (reputationData.data.length === 0 || detailsData.data.length === 0) {
            return null;
        }

        const reputation = reputationData.data[0];
        const details = detailsData.data[0];

        return {
            genericScore: this.calculateGenericScore(details.reputation.score.score),
            relativePlacement: this.calculateRelativePlacement(reputation),
            pairingScore: parseFloat(details.reputation_pairing_score.score),
            pairingChance: parseFloat(pairingChanceData.chance),
            chainID: reputation.chainID,
            cluster: reputation.cluster,
            timestamp: Math.floor(Date.now() / 1000)
        };
    }

    public async GetAllProviderReputationData(): Promise<Record<string, ProviderReputationMetrics[]>> {
        const metricsData = await RedisCache.getDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS) as Record<string, ProviderReputationMetrics[]>;

        if (!metricsData) {
            await this.refreshCache();
            return await RedisCache.getDict(REDIS_KEYS.ALL_PROVIDER_REPUTATION_METRICS) as Record<string, ProviderReputationMetrics[]> || {};
        }

        return metricsData;
    }

    public async GetReputationStats(): Promise<ProviderReputationStats> {
        const stats = await RedisCache.getDict(REDIS_KEYS.PROVIDER_REPUTATION_STATS) as ProviderReputationStats;

        if (!stats) {
            await this.refreshCache();
            return await RedisCache.getDict(REDIS_KEYS.PROVIDER_REPUTATION_STATS) as ProviderReputationStats || {
                genericScore: { sum: 0, count: 0, min: 0, max: 0 },
                relativePlacement: { sum: 0, count: 0, min: 0, max: 0 },
                pairingScore: { sum: 0, count: 0, min: 0, max: 0 },
                pairingChance: { sum: 0, count: 0, min: 0, max: 0 },
                lastUpdated: Math.floor(Date.now() / 1000)
            };
        }

        return stats;
    }
}

export const LavaRpcProviderReputation = new LavaRpcProviderReputationClass();

