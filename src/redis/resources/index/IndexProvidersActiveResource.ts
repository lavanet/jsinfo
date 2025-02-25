// src/query/handlers/indexProvidersActiveHandler.ts

import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, inArray } from "drizzle-orm";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { ActiveProvidersService } from './ActiveProvidersResource';
import { queryJsinfo } from '@jsinfo/utils/db';
import { logger } from '@jsinfo/utils/logger';
import { ProvidersReputationScoresService } from '@jsinfo/redis/resources/ProviderConsumerOptimizerMetrics/ProvidersReputationScores';
import { MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { IsMainnet } from '@jsinfo/utils/env';

export interface IndexProviderActive {
    provider: string;
    moniker: string;
    monikerfull?: string;
    activeServices: number;
    totalServices: number;
    totalStake: string; // Human-readable formatted stake
    rawTotalStake: bigint; // Raw stake value for sorting
    reputationScore: number | null;
    rank: number | null;
    formattedReputationScore?: string;
    rewardsUSD?: string;
    rewardsULAVA?: string;
}

interface ProviderData {
    provider: string | null;
    activeServices: number;
    totalServices: number;
    stake: bigint;
    delegateTotal: bigint;
}

// Helper function to format stake values
function formatStakeValue(stake: bigint): string {
    // Convert to LAVA (1 LAVA = 1,000,000 ulava)
    const lavaValue = Number(stake) / 1000000;

    // Format with commas and LAVA suffix
    return lavaValue.toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }) + ' LAVA';
}

export class IndexProvidersActiveResource extends RedisResourceBase<IndexProviderActive[], {}> {
    protected redisKey = 'index_providers_active_v4';
    protected cacheExpirySeconds = 3600; // 1 hour

    protected async fetchFromSource(): Promise<IndexProviderActive[]> {
        try {
            // Fetch base provider data with all the original fields
            const baseProviders = await this.fetchAllBaseProviderData();

            // Fetch reputation scores
            const reputationScores = await ProvidersReputationScoresService.fetch();

            // Create a map of reputation scores for quick lookup
            const reputationMap = new Map<string, number>();
            if (reputationScores) {
                reputationScores.forEach(score => {
                    if (score && score.provider) {
                        reputationMap.set(score.provider, score.reputationScore);
                    }
                });
            }

            // Sort providers by reputation score to determine ranks
            const sortedProviders = [...baseProviders].sort((a, b) => {
                const scoreA = reputationMap.get(a.provider) || 0;
                const scoreB = reputationMap.get(b.provider) || 0;
                return scoreB - scoreA;
            });

            // Create a map of ranks
            const rankMap = new Map<string, number | null>();
            let currentRank = 1;
            let lastScore = -1;

            sortedProviders.forEach((provider, index) => {
                const score = reputationMap.get(provider.provider) || 0;
                if (score === 0) {
                    rankMap.set(provider.provider, null);
                } else {
                    if (score !== lastScore) {
                        currentRank = index + 1;
                        lastScore = score;
                    }
                    rankMap.set(provider.provider, currentRank);
                }
            });

            // Add mainnet rewards data if applicable
            let providersWithRewards = baseProviders;
            if (IsMainnet()) {
                providersWithRewards = await this.addRewardsData(baseProviders);
            }

            // Combine all data with formatted values
            return providersWithRewards.map(provider => {
                const repScore = reputationMap.get(provider.provider) || null;
                const rank = rankMap.get(provider.provider) || null;

                return {
                    ...provider,
                    reputationScore: repScore,
                    rank: rank,
                    formattedReputationScore: repScore === null ? '-' : repScore.toFixed(3)
                };
            });

        } catch (error) {
            logger.error('Error fetching active providers:', error);
            return [];
        }
    }

    // This method fetches all the original provider data
    private async fetchAllBaseProviderData(): Promise<IndexProviderActive[]> {
        try {
            const activeProviders = await ActiveProvidersService.fetch();

            if (!activeProviders || activeProviders.length === 0) {
                return [];
            }

            const data = await queryJsinfo<ProviderData[]>(
                async (db: PostgresJsDatabase) => db
                    .select({
                        provider: JsinfoSchema.providerStakes.provider,
                        activeServices: sql<number>`SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END)`,
                        totalServices: sql<number>`COUNT(${JsinfoSchema.providerStakes.specId})`,
                        stake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT)), 0)`,
                        delegateTotal: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT)), 0)`
                    })
                    .from(JsinfoSchema.providerStakes)
                    .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                    .groupBy(JsinfoSchema.providerStakes.provider),
                `IndexProvidersActiveResource_fetchAllBaseProviderData`
            );

            return Promise.all(data.map(async item => {
                // Calculate total stake here
                const totalStake = item.stake + item.delegateTotal;

                return {
                    provider: item.provider || "",
                    moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider || ""),
                    monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider || ""),
                    activeServices: item.activeServices || 0,
                    totalServices: item.totalServices || 0,
                    rawTotalStake: totalStake, // Store raw value for sorting
                    totalStake: formatStakeValue(totalStake), // Store formatted value for display
                    reputationScore: null,  // Will be filled in later
                    rank: null  // Will be filled in later
                };
            }));
        } catch (error) {
            logger.error('Error in fetchAllBaseProviderData:', error);
            return [];
        }
    }

    // Add rewards data from MainnetProviderEstimatedRewardsGetService
    private async addRewardsData(providers: IndexProviderActive[]): Promise<IndexProviderActive[]> {
        try {
            const rewardsResponse = await MainnetProviderEstimatedRewardsGetService.fetch({
                block: 'latest_distributed'
            });

            if (!rewardsResponse?.data) {
                logger.warn('No rewards response data available');
                return providers.map(p => ({
                    ...p,
                    rewardsUSD: "-data not available-",
                    rewardsULAVA: "-data not available-"
                }));
            }

            return providers.map(provider => {
                const providerData = rewardsResponse.data.providers?.find(p => p.address === provider.provider);

                const rewardsLastMonthBlock = rewardsResponse.data.metadata.block_info?.height;
                if (!rewardsLastMonthBlock) {
                    return {
                        ...provider,
                        rewardsUSD: "-",
                        rewardsULAVA: "-"
                    };
                }

                if (providerData?.rewards_by_block[rewardsLastMonthBlock]?.total) {
                    const total = providerData.rewards_by_block[rewardsLastMonthBlock].total;
                    const rewardsUSD = `$${total.total_usd.toFixed(2)}`;
                    const lavaToken = total.tokens.find(t => t.display_denom === 'lava');
                    const rewardsULAVA = lavaToken ? lavaToken.resolved_amount : "-";

                    return {
                        ...provider,
                        rewardsUSD,
                        rewardsULAVA
                    };
                } else {
                    return {
                        ...provider,
                        rewardsUSD: "-",
                        rewardsULAVA: "-"
                    };
                }
            });
        } catch (error) {
            logger.error('Error fetching rewards data:', error);
            return providers.map(p => ({
                ...p,
                rewardsUSD: "-error-",
                rewardsULAVA: "-error-"
            }));
        }
    }

    public async ConvertRecordsToCsv(data: IndexProviderActive[]): Promise<string> {
        const columns = [
            { key: "moniker", name: "Moniker" },
            { key: "provider", name: "Provider Address" },
            { key: "formattedReputationScore", name: "Reputation Score" },
            { key: "rank", name: "Rank" },
            { key: "activeServices", name: "Active Services" },
            { key: "totalServices", name: "Total Services" },
            { key: "totalStake", name: "Total Stake" }
        ];

        // Add rewards columns only if on mainnet
        if (IsMainnet()) {
            columns.push(
                { key: "rewardsUSD", name: "Monthly Rewards (USD)" },
                { key: "rewardsULAVA", name: "Monthly Rewards (ULAVA)" }
            );
        }

        let csv = columns.map(column => CSVEscape(column.name)).join(',') + '\n';

        data.forEach((item: IndexProviderActive) => {
            csv += columns.map(column => {
                const keys = column.key.split('.');
                let value = keys.reduce((obj: any, key: string) =>
                    (obj && obj[key] !== undefined) ? obj[key] : '', item);

                // Format rank for CSV
                if (column.key === 'rank' && value !== '') {
                    value = value === null ? '-' : value;
                }

                return CSVEscape(String(value));
            }).join(',') + '\n';
        });

        return csv;
    }
}

export const IndexProvidersActiveService = new IndexProvidersActiveResource();

