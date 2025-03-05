// i want to have all this infromation monthly and non monthly , stackers and restakers:

import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';
import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import { MinimalToken, ProcessMinimalTokenArray, ProcessedToken, ProcessedMinimalTokenArray } from '@jsinfo/redis/resources/APR/ProcessLavaRpcTokenArray';
import { Delegation } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';

// Define token breakdown interface
export interface TokenBreakdown {
    denominations: ProcessedToken[];
    totalUlava: bigint;
    totalUSD: number;
}

// Define the response interface with a clearer structure
export interface StakersAndRestakersData {
    // Metadata
    lastUpdated: string;
    lavaUsdRate: number;

    // Active Providers top-level key
    activeProviders: {
        providers: string[];
        data: {
            allTime: {
                stakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
                restakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
            };
            monthly: {
                stakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
                restakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
            };
        };
    };

    // All Providers top-level key
    allProviders: {
        providers: string[];
        data: {
            allTime: {
                stakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
                restakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
            };
            monthly: {
                stakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
                restakers: {
                    count: number;
                    totalUSD: number;
                    totalLava: number;
                };
            };
        };
    };
}

/**
 * Helper interface for collecting delegation data
 */
interface DelegationCollectionResult {
    currentTokens: MinimalToken[];
    monthlyTokens: MinimalToken[];
    currentDelegators: Set<string>;
    monthlyDelegators: Set<string>;
}

// Stakers and Restakers Redis Resource
export class StakersAndRestakersResource extends RedisResourceBase<StakersAndRestakersData, {}> {
    protected readonly redisKey = 'StakersAndRestakersResource_v13';
    protected readonly cacheExpirySeconds = 1800; // 30 minutes cache

    /**
     * Main fetch method to get all stakers and restakers data
     */
    protected async fetchFromSource(): Promise<StakersAndRestakersData> {
        try {
            logger.info("Fetching stakers and restakers data with token breakdown");

            // Get LAVA USD rate
            const lavaUsdRate = await CoinGekoCache.GetLavaUSDRate();

            // Get current timestamp for 30 days ago (SECONDS since epoch)
            const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

            // Fetch provider lists
            const { allProviders, activeProviders } = await this.fetchProviderLists();

            // Process delegations for active providers (stakers) and all providers (restakers)
            const stakersResult = await this.processDelegations(activeProviders, thirtyDaysAgo, true);
            const restakersResult = await this.processDelegations(allProviders, thirtyDaysAgo, false);

            // Process token collections
            const tokenBreakdowns = await this.createTokenBreakdowns(
                stakersResult.currentTokens,
                stakersResult.monthlyTokens,
                restakersResult.currentTokens,
                restakersResult.monthlyTokens
            );

            // Get counts
            const counts = this.calculateCounts(
                stakersResult.currentDelegators,
                stakersResult.monthlyDelegators,
                restakersResult.currentDelegators,
                restakersResult.monthlyDelegators
            );

            // Pass the delegator sets to buildResponse
            return this.buildResponse(
                tokenBreakdowns,
                counts,
                activeProviders,
                allProviders,
                lavaUsdRate,
                {
                    stakersCurrentDelegators: stakersResult.currentDelegators,
                    stakersMonthlyDelegators: stakersResult.monthlyDelegators,
                    restakersCurrentDelegators: restakersResult.currentDelegators,
                    restakersMonthlyDelegators: restakersResult.monthlyDelegators
                }
            );
        } catch (error) {
            logger.error("Error in StakersAndRestakersResource.fetchFromSource", { error });
            throw error;
        }
    }

    /**
     * Fetch active and all provider lists
     */
    private async fetchProviderLists(): Promise<{ allProviders: string[], activeProviders: string[] }> {
        // Get all providers for restakers (includes both active and inactive)
        const allProviders = await RpcPeriodicEndpointCache.GetAllProvidersFromRpc();
        logger.info(`Got ${allProviders.length} total providers for restakers`);

        // Get active providers for stakers (only active ones)
        const activeProviders = await ActiveProvidersService.fetch() || [];
        logger.info(`Got ${activeProviders.length} active providers for stakers`);

        return { allProviders, activeProviders };
    }

    /**
     * Process delegations for a list of providers
     */
    private async processDelegations(
        providers: string[],
        thirtyDaysAgo: number,
        includeEmptyProvider: boolean
    ): Promise<DelegationCollectionResult> {
        const currentTokens: MinimalToken[] = [];
        const monthlyTokens: MinimalToken[] = [];
        const currentDelegators = new Set<string>();
        const monthlyDelegators = new Set<string>();

        // Process providers
        logger.info(`Processing ${providers.length} providers`);
        for (const provider of providers) {
            const delegations = await RpcPeriodicEndpointCache.getProviderDelegations(provider);
            if (delegations) {
                this.collectFromDelegations(
                    delegations,
                    thirtyDaysAgo,
                    currentTokens,
                    monthlyTokens,
                    currentDelegators,
                    monthlyDelegators
                );
            }
        }

        // Add empty provider delegations if needed
        if (includeEmptyProvider) {
            logger.info("Processing empty provider delegations");
            const emptyProviderDelegations = await RpcPeriodicEndpointCache.getProviderDelegations('empty_provider');
            if (emptyProviderDelegations) {
                this.collectFromDelegations(
                    emptyProviderDelegations,
                    thirtyDaysAgo,
                    currentTokens,
                    monthlyTokens,
                    currentDelegators,
                    monthlyDelegators
                );
            }
        }

        return { currentTokens, monthlyTokens, currentDelegators, monthlyDelegators };
    }

    /**
     * Collect tokens and delegators from delegations
     */
    private collectFromDelegations(
        delegations: Delegation[],
        thirtyDaysAgo: number,
        currentTokens: MinimalToken[],
        monthlyTokens: MinimalToken[],
        currentDelegators: Set<string>,
        monthlyDelegators: Set<string>
    ): void {
        logger.info(`Filtering delegations with cutoff timestamp ${thirtyDaysAgo}`);
        let monthlyCount = 0;

        // Collect all tokens for current period
        delegations.forEach(delegation => {
            if (delegation.amount && delegation.amount.denom && delegation.amount.amount) {
                // Always add to current tokens since these are active delegations
                currentTokens.push({
                    denom: delegation.amount.denom,
                    amount: delegation.amount.amount
                });

                // Track current delegators
                currentDelegators.add(delegation.delegator);

                // Apply monthly filter using timestamp since credit_timestamp may not exist
                // For monthly filtering, use the standard timestamp as a fallback
                const filterTimestamp = delegation.timestamp;
                const creationTime = typeof filterTimestamp === 'string' ?
                    parseInt(filterTimestamp, 10) :
                    filterTimestamp;

                // Only include in monthly if created within the last 30 days
                if (creationTime >= thirtyDaysAgo) {
                    monthlyCount++;
                    monthlyTokens.push({
                        denom: delegation.amount.denom,
                        amount: delegation.amount.amount
                    });

                    // Track monthly delegators
                    monthlyDelegators.add(delegation.delegator);
                }
            }
        });

        logger.info(`Collected ${delegations.length} total delegations, ${monthlyCount} created within the last 30 days`);
    }

    /**
     * Calculate delegator counts
     */
    private calculateCounts(
        stakersCurrentDelegators: Set<string>,
        stakersMonthlyDelegators: Set<string>,
        restakersCurrentDelegators: Set<string>,
        restakersMonthlyDelegators: Set<string>
    ): {
        stakersCurrentCount: number,
        stakersMonthlyCount: number,
        restakersCurrentCount: number,
        restakersMonthlyCount: number,
        totalCurrentCount: number,
        totalMonthlyCount: number
    } {
        const stakersCurrentCount = stakersCurrentDelegators.size;
        const stakersMonthlyCount = stakersMonthlyDelegators.size;
        const restakersCurrentCount = restakersCurrentDelegators.size;
        const restakersMonthlyCount = restakersMonthlyDelegators.size;

        const totalCurrentCount = stakersCurrentCount + restakersCurrentCount;
        const totalMonthlyCount = stakersMonthlyCount + restakersMonthlyCount;

        return {
            stakersCurrentCount,
            stakersMonthlyCount,
            restakersCurrentCount,
            restakersMonthlyCount,
            totalCurrentCount,
            totalMonthlyCount
        };
    }

    /**
     * Create token breakdowns for all data sets
     */
    private async createTokenBreakdowns(
        stakersCurrentTokens: MinimalToken[],
        stakersMonthlyTokens: MinimalToken[],
        restakersCurrentTokens: MinimalToken[],
        restakersMonthlyTokens: MinimalToken[]
    ): Promise<{
        stakersCurrentTokens: ProcessedMinimalTokenArray,
        stakersMonthlyTokens: ProcessedMinimalTokenArray,
        restakersCurrentTokens: ProcessedMinimalTokenArray,
        restakersMonthlyTokens: ProcessedMinimalTokenArray,
        totalCurrentTokens: ProcessedMinimalTokenArray,
        totalMonthlyTokens: ProcessedMinimalTokenArray
    }> {
        logger.info("Processing token collections");

        // Process all token collections and return results directly
        const stakersCurrentProcessed = await ProcessMinimalTokenArray(stakersCurrentTokens);
        const restakersCurrentProcessed = await ProcessMinimalTokenArray(restakersCurrentTokens);
        const stakersMonthlyProcessed = await ProcessMinimalTokenArray(stakersMonthlyTokens);
        const restakersMonthlyProcessed = await ProcessMinimalTokenArray(restakersMonthlyTokens);

        // Calculate totals
        const totalCurrentTokens: MinimalToken[] = [...stakersCurrentTokens, ...restakersCurrentTokens];
        const totalMonthlyTokens: MinimalToken[] = [...stakersMonthlyTokens, ...restakersMonthlyTokens];

        const totalCurrentProcessed = await ProcessMinimalTokenArray(totalCurrentTokens);
        const totalMonthlyProcessed = await ProcessMinimalTokenArray(totalMonthlyTokens);

        return {
            stakersCurrentTokens: stakersCurrentProcessed,
            stakersMonthlyTokens: stakersMonthlyProcessed,
            restakersCurrentTokens: restakersCurrentProcessed,
            restakersMonthlyTokens: restakersMonthlyProcessed,
            totalCurrentTokens: totalCurrentProcessed,
            totalMonthlyTokens: totalMonthlyProcessed
        };
    }

    /**
     * Build the final response object
     */
    private buildResponse(
        tokenBreakdowns: {
            stakersCurrentTokens: ProcessedMinimalTokenArray,
            stakersMonthlyTokens: ProcessedMinimalTokenArray,
            restakersCurrentTokens: ProcessedMinimalTokenArray,
            restakersMonthlyTokens: ProcessedMinimalTokenArray,
            totalCurrentTokens: ProcessedMinimalTokenArray,
            totalMonthlyTokens: ProcessedMinimalTokenArray
        },
        counts: {
            stakersCurrentCount: number,
            stakersMonthlyCount: number,
            restakersCurrentCount: number,
            restakersMonthlyCount: number,
            totalCurrentCount: number,
            totalMonthlyCount: number
        },
        activeProviders: string[],
        allProviders: string[],
        lavaUsdRate: number,
        delegators: {
            stakersCurrentDelegators: Set<string>,
            stakersMonthlyDelegators: Set<string>,
            restakersCurrentDelegators: Set<string>,
            restakersMonthlyDelegators: Set<string>
        }
    ): StakersAndRestakersData {
        // Get total LAVA amount by summing all lava tokens in the tokens array
        const getTotalLava = (processed: ProcessedMinimalTokenArray): number => {
            // Sum up all lava token amounts
            let totalLava = 0;
            processed.tokens.forEach(token => {
                if (token.display_denom === 'lava') {
                    totalLava += parseFloat(token.display_amount);
                }
            });

            // Use the calculated total or fall back to USD conversion
            if (totalLava > 0) {
                return totalLava;
            } else {
                return processed.total_usd / lavaUsdRate;
            }
        };

        return {
            // Metadata
            lastUpdated: new Date().toISOString(),
            lavaUsdRate,

            // Active Providers section
            activeProviders: {
                providers: activeProviders,
                data: {
                    allTime: {
                        stakers: {
                            count: counts.stakersCurrentCount,
                            totalUSD: tokenBreakdowns.stakersCurrentTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.stakersCurrentTokens)
                        },
                        restakers: {
                            count: counts.restakersCurrentCount,
                            totalUSD: tokenBreakdowns.restakersCurrentTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.restakersCurrentTokens)
                        }
                    },
                    monthly: {
                        stakers: {
                            count: counts.stakersMonthlyCount,
                            totalUSD: tokenBreakdowns.stakersMonthlyTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.stakersMonthlyTokens)
                        },
                        restakers: {
                            count: counts.restakersMonthlyCount,
                            totalUSD: tokenBreakdowns.restakersMonthlyTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.restakersMonthlyTokens)
                        }
                    }
                }
            },

            // All Providers section
            allProviders: {
                providers: allProviders,
                data: {
                    allTime: {
                        stakers: {
                            count: counts.stakersCurrentCount,
                            totalUSD: tokenBreakdowns.stakersCurrentTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.stakersCurrentTokens)
                        },
                        restakers: {
                            count: counts.restakersCurrentCount,
                            totalUSD: tokenBreakdowns.restakersCurrentTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.restakersCurrentTokens)
                        }
                    },
                    monthly: {
                        stakers: {
                            count: counts.stakersMonthlyCount,
                            totalUSD: tokenBreakdowns.stakersMonthlyTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.stakersMonthlyTokens)
                        },
                        restakers: {
                            count: counts.restakersMonthlyCount,
                            totalUSD: tokenBreakdowns.restakersMonthlyTokens.total_usd,
                            totalLava: getTotalLava(tokenBreakdowns.restakersMonthlyTokens)
                        }
                    }
                }
            }
        };
    }
}

// Create singleton instance
export const StakersAndRestakersService = new StakersAndRestakersResource();
