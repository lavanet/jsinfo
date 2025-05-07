import { desc, sql, inArray, gte, and } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { queryJsinfo } from '@jsinfo/utils/db';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { ConvertToChainName } from '@jsinfo/lib/chain-mapping/chains';
import GetIconForSpec from '@jsinfo/lib/icons/ChainIcons';
import { logger } from '@jsinfo/utils/logger';
import { ReplaceArchive } from '@jsinfo/indexer/utils/indexerUtils';
import { BigIntIsZero } from '@jsinfo/utils/bigint';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { GetAllProviderAvatars } from '@jsinfo/restRpc/GetProviderAvatar';
import { IsMainnet } from '@jsinfo/utils/env';
import { GetResourceResponse, MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import Decimal from 'decimal.js';
import { RpcOnDemandProviderVersionEndpointCache } from '@jsinfo/restRpc/LavaRpcOnDemandProviderVersionEndpointCache';

// Helper function to map status codes to readable strings
function getStatusString(statusCode: number | null): string {
    if (statusCode === null) return "Unknown";

    switch (statusCode) {
        case JsinfoSchema.LavaProviderStakeStatus.Active:
            return "Active";
        case JsinfoSchema.LavaProviderStakeStatus.Frozen:
            return "Frozen";
        case JsinfoSchema.LavaProviderStakeStatus.Unstaking:
            return "Unstaking";
        case JsinfoSchema.LavaProviderStakeStatus.Inactive:
            return "Inactive";
        case JsinfoSchema.LavaProviderStakeStatus.Jailed:
            return "Jailed";
        default:
            return `Unknown (${statusCode})`;
    }
}

export interface ProviderStakeInfo {
    stake: string;
    delegateTotal: string;
}

// Update the HealthData interface to include region information
export interface HealthData {
    overallStatus: string; // 'healthy', 'unhealthy', 'frozen', 'jailed', 'degraded', etc.
    interfaces: string[];  // List of interfaces like 'rest', 'tendermintrpc', etc.
    lastTimestamp: string; // Most recent health check timestamp
    interfaceDetails: {
        [interfaceName: string]: {
            status: string;
            message: string;
            timestamp: string;
            region: string; // Add region information
        }
    };
}

// Update the RewardsData interface to include _sources
export interface RewardsData {
    lava: string;
    usd: string;
    _sources?: any[]; // Add this line to support debugging sources
}

// New detailed interface with usage metrics
export interface DetailedStakeInfo {
    stake: string;
    delegateTotal: string;
    delegateCommission: string;
    totalStake: string;
    appliedHeight: number;
    geolocation: number;
    addons: string;
    extensions: string;
    status: number;
    statusString: string;
    provider: string;
    specId: string;
    blockId: number;
    chainName: string;
    chainIcon: string;
    moniker?: string;
    monikerfull?: string;
    providerAvatar?: string;
    // Usage statistics
    cuSum30Days: number;
    cuSum90Days: number;
    relaySum30Days: number;
    relaySum90Days: number;
    // Replace simple string with structured rewards data
    rewards: RewardsData | "No data available";
    // Health data
    health?: HealthData | "No data available";
}

// Refined stakes summary interface with breakdown by status
export interface StakesSummary {
    // All stakes
    totalStakeSum: string;
    totalDelegationSum: string;
    totalCombinedSum: string;

    // Active stakes only
    activeStakeSum: string;
    activeDelegationSum: string;
    activeCombinedSum: string;

    // Frozen stakes only
    frozenStakeSum: string;
    frozenDelegationSum: string;
    frozenCombinedSum: string;

    // Jailed stakes only
    jailedStakeSum: string;
    jailedDelegationSum: string;
    jailedCombinedSum: string;
}

export interface ProviderStakesAndDelegationData {
    // Original aggregated data
    stakeSum: string;
    delegationSum: string;
    stakeTotalSum: string;

    // Detailed summary with breakdown by status
    summary: StakesSummary;

    // Provider stakes info (original format for backward compatibility)
    providerStakes: Record<string, ProviderStakeInfo>;

    // Detailed provider stake data (keyed by provider address)
    detailedProviderStakes?: Record<string, DetailedStakeInfo[]>;

    // Spec-based stake data (keyed by spec ID)
    detailedSpecStakes?: Record<string, DetailedStakeInfo[]>;
}

// Add this interface to properly type the status data
export interface StakesByStatus {
    status: number | null;
    stake: bigint;
    delegateTotal: bigint;
}

type DetailedStakesResult = {
    stake: bigint | null;
    delegateTotal: bigint | null;
    delegateCommission: bigint | null;
    appliedHeight: number | null;
    geolocation: number | null;
    addons: string | null;
    extensions: string | null;
    status: number | null;
    provider: string | null;
    specId: string | null;
    blockId: number | null;
    totalStake: bigint;
}

type UsageMetrics90Days = {
    provider: string | null;
    specId: string | null;
    cuSum90Days: number;
    relaySum90Days: number;
}

type UsageMetrics30Days = {
    provider: string | null;
    specId: string | null;
    cuSum30Days: number;
    relaySum30Days: number;
}

export class ProviderStakesAndDelegationResource extends RedisResourceBase<ProviderStakesAndDelegationData, {}> {
    protected readonly redisKey = 'ProviderStakesAndDelegationResource_v12';
    protected readonly cacheExpirySeconds = 1800; // 30 minutes cache

    // Main fetch method
    protected async fetchFromSource(): Promise<ProviderStakesAndDelegationData> {
        try {
            logger.info("Fetching provider stakes and delegation data from source");

            let providerAddresses: string[] = [];
            try {
                const activeProviders = await ActiveProvidersService.fetch();
                logger.info(`ActiveProvidersService returned ${activeProviders?.length || 0} providers`);

                if (activeProviders && activeProviders.length > 0) {
                    providerAddresses = activeProviders;
                    logger.info(`First 5 provider addresses: ${providerAddresses.slice(0, 5).join(', ')}`);
                }

                // If we have no providers, retry once after a delay
                if (providerAddresses.length === 0) {
                    logger.warn("No providers found, waiting 5 seconds to retry...");
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    const retryProviders = await ActiveProvidersService.fetch();
                    if (retryProviders && retryProviders.length > 0) {
                        providerAddresses = retryProviders;
                        logger.info(`After retry, found ${providerAddresses.length} providers`);
                    }
                }

                logger.info(`Fetching data for ${providerAddresses.length} providers`);
            } catch (error) {
                logger.error("Error fetching active providers:", error);
            }

            // Fetch rewards data
            let rewardsData: GetResourceResponse | null = null;
            if (IsMainnet()) {
                try {
                    // logger.info("Fetching MainnetProviderEstimatedRewardsGetService data...");
                    rewardsData = await MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest_distributed' });
                    // logger.info(`Fetched rewards data in ${Date.now() - startTime}ms for ${rewardsData?.data?.providers?.length || 0} providers`);
                } catch (error) {
                    logger.error("Error fetching rewards data:", error);
                }
            }

            // Additional debug logs
            // logger.info(`Starting Promise.all for various data fetches`);

            const [
                stakesRes,
                stakesByStatusRes,
                detailedStakesRes,
                aggRes90Days,
                aggRes30Days,
                providerHealthData,
                avatarMap
            ] = await Promise.all([
                this.fetchBasicStakesData(providerAddresses),
                this.fetchStakesByStatus(providerAddresses),
                this.fetchDetailedStakes(providerAddresses),
                this.fetch90DayMetrics(providerAddresses),
                this.fetch30DayMetrics(providerAddresses),
                this.fetchProviderHealth(providerAddresses),
                GetAllProviderAvatars()
            ]);

            // Create usage metrics maps
            const aggRes90DaysMap = new Map<string, UsageMetrics90Days>(
                aggRes90Days
                    .filter(item => item.provider !== null && item.specId !== null)
                    .map(item => [`${item.provider}:${item.specId}`, item as UsageMetrics90Days])
            );
            const aggRes30DaysMap = new Map<string, UsageMetrics30Days>(
                aggRes30Days
                    .filter(item => item.provider !== null && item.specId !== null)
                    .map(item => [`${item.provider}:${item.specId}`, item as UsageMetrics30Days])
            );

            // Process rewards data
            const rewardsMap = this.processRewardsData(rewardsData);

            // Process the basic stakes data
            const { stakeSum, delegationSum, providerStakes } = this.processBasicStakesData(stakesRes);

            // Handle case with no data
            if (!stakesRes || stakesRes.length === 0) {
                logger.warn(`No stake data found, returning empty response`);
                return this.createEmptyResponse();
            }

            // Convert map to object using a more direct approach
            const avatars: Record<string, string> = {};
            avatarMap.forEach((value, key) => {
                avatars[key] = value;
            });

            // Pass the health data and rewards map to the detailed stakes processing
            const { detailedProviderStakes, detailedSpecStakes } =
                await this.processDetailedStakes(
                    detailedStakesRes,
                    aggRes90DaysMap,
                    aggRes30DaysMap,
                    providerHealthData,
                    avatars,
                    rewardsMap // Pass rewardsMap to processDetailedStakes
                );

            // Generate summary
            const summary = this.createSummary(stakeSum, delegationSum, stakesByStatusRes);

            // Return complete data
            const result = {
                stakeSum: stakeSum.toString(),
                delegationSum: delegationSum.toString(),
                stakeTotalSum: (stakeSum + delegationSum).toString(),
                summary,
                providerStakes,
                detailedProviderStakes,
                detailedSpecStakes
            };

            return result;
        } catch (error) {
            logger.error("Error fetching provider stakes and delegation:", error);
            // Log the error stack trace for better debugging
            if (error instanceof Error) {
                logger.error(`Error stack: ${error.stack}`);
            }
            return this.createEmptyResponse();
        }
    }

    // Fetch basic stakes data for backward compatibility
    private async fetchBasicStakesData(providerAddresses: string[]): Promise<DetailedStakesResult[]> {
        // logger.info(`fetchBasicStakesData called with ${providerAddresses.length} providers`);

        return await queryJsinfo(async (db) => {
            try {
                const query = db.select({
                    stake: JsinfoSchema.providerStakes.stake,
                    delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
                    delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
                    appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
                    geolocation: JsinfoSchema.providerStakes.geolocation,
                    addons: JsinfoSchema.providerStakes.addons,
                    extensions: JsinfoSchema.providerStakes.extensions,
                    status: JsinfoSchema.providerStakes.status,
                    provider: JsinfoSchema.providerStakes.provider,
                    specId: JsinfoSchema.providerStakes.specId,
                    blockId: JsinfoSchema.providerStakes.blockId,
                    totalStake: sql<bigint>`(${JsinfoSchema.providerStakes.stake} + ${JsinfoSchema.providerStakes.delegateTotal}) as totalStake`,
                })
                    .from(JsinfoSchema.providerStakes);

                // Only apply filter if we have addresses
                if (providerAddresses.length > 0) {
                    query.where(inArray(JsinfoSchema.providerStakes.provider, providerAddresses));
                    logger.info(`Applied provider filter to stakes query`);
                } else {
                    logger.info(`No provider filter applied to stakes query`);
                }

                const results = await query.orderBy(desc(JsinfoSchema.providerStakes.stake));

                return results;
            } catch (error) {
                logger.error(`Error in fetchBasicStakesData: ${error}`);
                return [];
            }
        }, 'ProviderStakesAndDelegationResource::fetchBasicStakesData');
    }

    // Fetch stakes broken down by status
    private async fetchStakesByStatus(providerAddresses: string[] = []): Promise<StakesByStatus[]> {
        return await queryJsinfo(db => db.select({
            status: JsinfoSchema.providerStakes.status,
            stake: sql<bigint>`sum(${JsinfoSchema.providerStakes.stake})`,
            delegateTotal: sql<bigint>`sum(${JsinfoSchema.providerStakes.delegateTotal})`
        })
            .from(JsinfoSchema.providerStakes)
            .where(
                and(
                    inArray(JsinfoSchema.providerStakes.status, [
                        JsinfoSchema.LavaProviderStakeStatus.Active,
                        JsinfoSchema.LavaProviderStakeStatus.Frozen,
                        JsinfoSchema.LavaProviderStakeStatus.Jailed
                    ])
                    ,
                    inArray(JsinfoSchema.providerStakes.provider, providerAddresses))
            )
            .groupBy(JsinfoSchema.providerStakes.status),
            'ProviderStakesAndDelegationResource::fetchStakesByStatus'
        );
    }

    // Fetch detailed stake information
    private async fetchDetailedStakes(providerAddresses: string[] = []): Promise<DetailedStakesResult[]> {
        return await queryJsinfo(async (db) => await db.select({
            stake: JsinfoSchema.providerStakes.stake,
            delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
            delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
            appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
            geolocation: JsinfoSchema.providerStakes.geolocation,
            addons: JsinfoSchema.providerStakes.addons,
            extensions: JsinfoSchema.providerStakes.extensions,
            status: JsinfoSchema.providerStakes.status,
            provider: JsinfoSchema.providerStakes.provider,
            specId: JsinfoSchema.providerStakes.specId,
            blockId: JsinfoSchema.providerStakes.blockId,
            totalStake: sql<bigint>`(${JsinfoSchema.providerStakes.stake} + ${JsinfoSchema.providerStakes.delegateTotal}) as totalStake`,
        })
            .from(JsinfoSchema.providerStakes)
            .where(inArray(JsinfoSchema.providerStakes.provider, providerAddresses))
            .orderBy(desc(JsinfoSchema.providerStakes.stake)),
            'ProviderStakesAndDelegationResource::fetchDetailedStakes'
        );
    }

    // Fix fetch90DayMetrics method
    private async fetch90DayMetrics(providerAddresses: string[] = []): Promise<UsageMetrics90Days[]> {
        if (providerAddresses.length === 0) return [];

        return await queryJsinfo(db => db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        })
            .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .where(
                and(
                    sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday} > now() - interval '90 day'`,
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, providerAddresses)
                )
            )
            .groupBy(
                JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
            ), 'ProviderStakesAndDelegationResource::fetch90DayMetrics');
    }

    // Fix the fetch30DayMetrics method
    private async fetch30DayMetrics(providerAddresses: string[] = []): Promise<UsageMetrics30Days[]> {
        if (providerAddresses.length === 0) return [];

        return await queryJsinfo(db => db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        })
            .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .where(
                and(
                    sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday} > now() - interval '30 day'`,
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, providerAddresses)
                )
            )
            .groupBy(
                JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
            ), 'ProviderStakesAndDelegationResource::fetch30DayMetrics');
    }

    // Improve health message formatting based on providerHealthLatestHandler
    private formatHealthMessage(data: string | null): string {
        if (!data) return "";

        try {
            const parsedData = JSON.parse(data);

            // Case 1: If there's a direct message field
            if (parsedData.message) {
                return parsedData.message;
            }

            // Case 2: If it's jail data
            if (parsedData.jail_end_time && parsedData.jails) {
                const date = new Date(parsedData.jail_end_time);
                // Skip bad data (1970 dates)
                if (date.getFullYear() === 1970) return "";

                const formattedDate = date.toISOString().replace('T', ' ').substring(0, 19);
                return `End Time: ${formattedDate}, Jails: ${parsedData.jails}`;
            }

            // Case 3: Block data (most common for NEAR)
            if (parsedData.block && parsedData.others) {
                let finalMessage = `Block: ${parsedData.block}`;

                // Only add others if different from block
                if (parsedData.others !== parsedData.block) {
                    finalMessage += `, Others: ${parsedData.others}`;
                }

                // Add latency if available
                if (parsedData.latency) {
                    const latencyMs = Math.round(parsedData.latency / 1000000);
                    finalMessage += `, Latency: ${latencyMs}ms`;
                }

                return finalMessage;
            }

            // Default: return JSON string representation
            return JSON.stringify(parsedData);
        } catch (e) {
            // If parsing fails, return the original data
            return data;
        }
    }

    // Extract rewards processing to its own function
    private processRewardsData(rewardsData: GetResourceResponse | null): Map<string, any> {
        const rewardsMap = new Map<string, any>();
        if (!rewardsData || !rewardsData.data || !rewardsData.data.providers) {
            return rewardsMap;
        }

        // Process each provider's rewards data
        for (const provider of rewardsData.data.providers) {
            const providerAddress = provider.address;

            // Skip if no rewards data for this block
            if (!provider.rewards_by_block || Object.keys(provider.rewards_by_block).length === 0) {
                continue;
            }

            // Get the latest block's rewards data (first key in object)
            const latestBlockKey = Object.keys(provider.rewards_by_block)[0];
            const blockData = provider.rewards_by_block[latestBlockKey];

            // Skip if no info or total
            if (!blockData.info || !blockData.total) {
                continue;
            }

            // Process each reward info entry (these are per-chain/spec rewards)
            for (const rewardInfo of blockData.info) {
                // Extract the spec from the source (e.g., "Boost: COSMOSHUB" -> "COSMOSHUB")
                const sourceParts = rewardInfo.source.split(': ');
                if (sourceParts.length < 2) continue;

                const rewardType = sourceParts[0];  // e.g., "Boost", "Pool", "Subscription"
                const specId = sourceParts[1];      // e.g., "COSMOSHUB", "EVMOS"

                // Create a unique key for this provider+spec
                const key = `${providerAddress}:${specId}`;

                // Get existing data or initialize new
                let specRewards = rewardsMap.get(key) || {
                    lava: 0,
                    usd: 0,
                    sources: []
                };

                // Add the current reward source to track where rewards are coming from
                specRewards.sources.push(rewardInfo.source);

                // Add token values based on denom
                if (rewardInfo.amount && rewardInfo.amount.tokens) {
                    for (const token of rewardInfo.amount.tokens) {
                        // Handle LAVA tokens
                        if (token.display_denom === 'lava') {
                            const lavaValue = new Decimal(token.display_amount || '0');
                            specRewards.lava = new Decimal(specRewards.lava).plus(lavaValue);
                        }

                        // Add USD values from token if present
                        if (token.value_usd) {
                            const usdValue = parseFloat(token.value_usd.replace(/[^0-9.]/g, '') || '0');
                            specRewards.usd += usdValue;
                        }
                    }
                }

                // // Add USD total if present
                // if (rewardInfo.amount && rewardInfo.amount.total_usd) {
                //     const totalUsd = rewardInfo.amount.total_usd;
                //     // Check if totalUsd is already accounted for in token.value_usd values
                //     // If not, add it here
                // }

                // Update the map
                rewardsMap.set(key, specRewards);
            }

            // Also store the total rewards for this provider
            if (blockData.total) {
                let totalLava = "0";
                let totalUsd = "0";

                // Sum up the LAVA tokens
                if (blockData.total.tokens) {
                    for (const token of blockData.total.tokens) {
                        if (token.display_denom === 'lava') {
                            totalLava = token.display_amount || "0";
                        }
                    }
                }

                // Get the total USD value
                if (blockData.total.total_usd) {
                    totalUsd = blockData.total.total_usd.toString();
                }

                // Store the provider's total (useful for verification)
                rewardsMap.set(providerAddress, {
                    lava: totalLava,
                    usd: totalUsd,
                    isTotal: true
                });
            }
        }

        return rewardsMap;
    }

    // Fix the processHealthData function to better handle region data
    private async processHealthData(healthData: any[]): Promise<Record<string, Record<string, HealthData | string>>> {
        const healthDataResult: Record<string, Record<string, HealthData | string>> = {};

        // Known regions
        const knownRegions = new Set(['EU', 'US', 'ASIA']);

        // Group records by provider and spec
        const groupedRecords: Record<string, Record<string, any[]>> = {};

        for (const record of healthData) {
            if (!record.provider || !record.spec) continue;

            if (!groupedRecords[record.provider]) {
                groupedRecords[record.provider] = {};
            }

            if (!groupedRecords[record.provider][record.spec]) {
                groupedRecords[record.provider][record.spec] = [];
            }

            groupedRecords[record.provider][record.spec].push(record);
        }

        // Process each provider and spec
        for (const provider in groupedRecords) {
            if (!healthDataResult[provider]) {
                healthDataResult[provider] = {};
            }

            for (const spec in groupedRecords[provider]) {
                const records = groupedRecords[provider][spec];

                // Get the most recent record for determining overall status
                records.sort((a, b) =>
                    b.timestamp.getTime() - a.timestamp.getTime()
                );

                const mostRecentRecord = records[0];

                // Get interface type safely
                const interfaceType = mostRecentRecord.interface_type || 'jsonrpc';

                // Normalize region
                const region = knownRegions.has(mostRecentRecord.region)
                    ? mostRecentRecord.region
                    : mostRecentRecord.geolocation || 'Unknown';

                // Format the health message
                const formattedMessage = this.formatHealthMessage(mostRecentRecord.message || mostRecentRecord.data);

                // Check for version upgrade message
                let status = mostRecentRecord.status?.toLowerCase() || 'unknown';
                if (status === 'healthy' || status == 'unhealthy') {
                    const versionMatch = formattedMessage.match(/Version:(\d+\.\d+\.\d+)\s+should be:\s+(\d+\.\d+\.\d+)/);
                    if (versionMatch) {
                        const currentVersion = versionMatch[1];
                        const targetVersion = versionMatch[2];

                        try {
                            // Simply await the version check
                            const isHigherThanMin = await RpcOnDemandProviderVersionEndpointCache.IsVersionHigherThanMinProviderVersion(currentVersion);

                            if (isHigherThanMin) {
                                // Version is above minimum requirements but should be upgraded
                                status = 'version_upgrade_available';
                                // logger.info(`Provider ${provider} version ${currentVersion} is higher than minimum but should be upgraded to ${targetVersion}`);
                            } else {
                                // Version is below minimum, upgrade is required
                                status = 'version_upgrade_required';
                                // logger.warn(`Provider ${provider} version ${currentVersion} is below minimum required, needs upgrade to ${targetVersion}`);
                            }
                        } catch (error) {
                            // On error, use the more restrictive status
                            status = 'version_upgrade_required';
                            logger.error("Error checking provider version", { error, provider, currentVersion });
                        }
                    }
                }

                // Create health data object with potentially updated status
                const healthInfo: HealthData = {
                    overallStatus: status, // Use the potentially updated status
                    interfaces: [interfaceType],
                    lastTimestamp: mostRecentRecord.timestamp?.toISOString(),
                    interfaceDetails: {
                        [interfaceType]: {
                            status: status, // Same status for interface details
                            message: formattedMessage,
                            timestamp: mostRecentRecord.timestamp?.toISOString(),
                            region: region
                        }
                    }
                };

                healthDataResult[provider][spec] = healthInfo;
            }
        }

        return healthDataResult;
    }

    // Then update the fetchProviderHealth method to use this function:
    private async fetchProviderHealth(providerAddresses: string[] = []): Promise<Record<string, Record<string, HealthData | string>>> {
        // If no providers, return empty result immediately
        if (providerAddresses.length === 0) {
            logger.info("No providers to fetch health data for, returning empty result");
            return {};
        }

        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

        // Only run the query when we have providers to check
        const healthData = await queryJsinfo(db => db.select()
            .from(JsinfoSchema.providerHealth)
            .where(
                and(
                    gte(JsinfoSchema.providerHealth.timestamp, fourHoursAgo),
                    inArray(JsinfoSchema.providerHealth.provider, providerAddresses)
                )
            )
            .orderBy(desc(JsinfoSchema.providerHealth.timestamp)),
            'ProviderStakesAndDelegationResource::fetchProviderHealth');

        return this.processHealthData(healthData);
    }

    // Process basic stakes data
    private processBasicStakesData(stakesRes: DetailedStakesResult[]): { stakeSum: bigint; delegationSum: bigint; providerStakes: Record<string, ProviderStakeInfo> } {
        let stakeSum = 0n;
        let delegationSum = 0n;
        const providerStakes: Record<string, ProviderStakeInfo> = {};

        stakesRes.forEach((stake) => {
            if (stake.provider !== null && !IsMeaningfulText(stake.provider)) return;

            stakeSum += BigInt(stake.stake || 0n);
            delegationSum += BigInt(stake.delegateTotal || 0n);

            providerStakes[stake.provider!] = {
                stake: BigInt(stake.stake || 0n).toString(),
                delegateTotal: BigInt(stake.delegateTotal || 0n).toString()
            };
        });

        return { stakeSum, delegationSum, providerStakes };
    }

    // Update the processDetailedStakes method to use this improved health data
    private async processDetailedStakes(
        detailedStakesRes: DetailedStakesResult[],
        aggRes90DaysMap: Map<string, UsageMetrics90Days>,
        aggRes30DaysMap: Map<string, UsageMetrics30Days>,
        providerHealthData: Record<string, any> | null,
        avatars: Record<string, string>,
        rewardsMap: Map<string, any> // Use our new rewards map
    ): Promise<{
        detailedProviderStakes: Record<string, DetailedStakeInfo[]>;
        detailedSpecStakes: Record<string, DetailedStakeInfo[]>;
    }> {
        const detailedProviderStakes: Record<string, DetailedStakeInfo[]> = {};
        const detailedSpecStakes: Record<string, DetailedStakeInfo[]> = {};

        for (const item of detailedStakesRes) {
            if (!item.provider || !IsMeaningfulText(item.provider) || !item.specId) continue;

            // Get usage metrics
            const key = `${item.provider}:${item.specId}`;
            const metrics90Days = aggRes90DaysMap.get(key) || {
                provider: item.provider,
                specId: item.specId,
                cuSum90Days: 0,
                relaySum90Days: 0
            };
            const metrics30Days = aggRes30DaysMap.get(key) || {
                provider: item.provider,
                specId: item.specId,
                cuSum30Days: 0,
                relaySum30Days: 0
            };

            // Get moniker data with debug logging
            const moniker = await ProviderMonikerService.GetMonikerForProvider(item.provider);
            // logger.debug(`Retrieved moniker for ${item.provider}: ${moniker || 'empty'}`);

            const monikerfull = await ProviderMonikerService.GetMonikerFullDescription(item.provider);
            // logger.debug(`Retrieved monikerfull for ${item.provider}: ${monikerfull || 'empty'}`);

            // Convert spec ID to chain name and get icon
            const chainName = ConvertToChainName(item.specId || '');
            const chainIcon = GetIconForSpec(item.specId || '') || '';

            // Get health data
            let health: HealthData | "No data available" = "No data available";
            if (providerHealthData && providerHealthData[item.provider] && providerHealthData[item.provider][item.specId]) {
                const healthValue = providerHealthData[item.provider][item.specId];
                // Only assign if it's a HealthData object, otherwise keep "No data available"
                if (typeof healthValue === 'object') {
                    health = healthValue;
                }
            }

            // Get the provider's avatar
            const providerAvatar = avatars[item.provider] || undefined;

            // Get rewards data if on mainnet or set to "No data available"
            const rewards = rewardsMap.get(key);

            const detailedInfo: DetailedStakeInfo = {
                stake: BigIntIsZero(item.stake) ? "0" : item.stake?.toString() ?? "0",
                delegateTotal: BigIntIsZero(item.delegateTotal) ? "0" : item.delegateTotal?.toString() ?? "0",
                delegateCommission: BigIntIsZero(item.delegateCommission) ? "0" : item.delegateCommission?.toString() ?? "0",
                totalStake: BigIntIsZero(item.totalStake) ? "0" : item.totalStake?.toString() ?? "0",
                appliedHeight: item.appliedHeight || 0,
                geolocation: item.geolocation || 0,
                addons: item.addons ? item.addons : "-",
                extensions: item.extensions ? ReplaceArchive(item.extensions || '') : "-",
                status: item.status || 0,
                statusString: getStatusString(item.status),
                provider: item.provider,
                specId: item.specId || '',
                blockId: item.blockId || 0,
                chainName,
                chainIcon,
                moniker,
                monikerfull,
                providerAvatar,
                // Usage metrics
                cuSum30Days: metrics30Days.cuSum30Days || 0,
                cuSum90Days: metrics90Days.cuSum90Days || 0,
                relaySum30Days: metrics30Days.relaySum30Days || 0,
                relaySum90Days: metrics90Days.relaySum90Days || 0,
                rewards: rewards ? {
                    lava: new Decimal(rewards.lava).toFixed(3),
                    usd: new Decimal(rewards.usd).toFixed(2),
                    _sources: rewards.sources
                } : "No data available",
                health
            };

            // Add to provider-indexed collection
            if (!detailedProviderStakes[item.provider]) {
                detailedProviderStakes[item.provider] = [];
            }
            detailedProviderStakes[item.provider].push(detailedInfo);

            // Add to spec-indexed collection
            if (!detailedSpecStakes[item.specId]) {
                detailedSpecStakes[item.specId] = [];
            }
            detailedSpecStakes[item.specId].push(detailedInfo);
        }

        return { detailedProviderStakes, detailedSpecStakes };
    }

    // Create the summary object
    private createSummary(stakeSum: bigint, delegationSum: bigint, stakesByStatusRes: StakesByStatus[]): StakesSummary {
        // Create a map for quick status lookups
        const statusMap = new Map(stakesByStatusRes.map(item => [item.status, item]));

        // Get active stakes
        const activeItem = statusMap.get(JsinfoSchema.LavaProviderStakeStatus.Active);
        const activeStakeSum = BigInt(activeItem?.stake || 0n);
        const activeDelegationSum = BigInt(activeItem?.delegateTotal || 0n);
        const activeCombinedSum = activeStakeSum + activeDelegationSum;

        // Get frozen stakes
        const frozenItem = statusMap.get(JsinfoSchema.LavaProviderStakeStatus.Frozen);
        const frozenStakeSum = BigInt(frozenItem?.stake || 0n);
        const frozenDelegationSum = BigInt(frozenItem?.delegateTotal || 0n);
        const frozenCombinedSum = frozenStakeSum + frozenDelegationSum;

        // Get jailed stakes
        const jailedItem = statusMap.get(JsinfoSchema.LavaProviderStakeStatus.Jailed);
        const jailedStakeSum = BigInt(jailedItem?.stake || 0n);
        const jailedDelegationSum = BigInt(jailedItem?.delegateTotal || 0n);
        const jailedCombinedSum = jailedStakeSum + jailedDelegationSum;

        return {
            totalStakeSum: stakeSum.toString(),
            totalDelegationSum: delegationSum.toString(),
            totalCombinedSum: (stakeSum + delegationSum).toString(),
            activeStakeSum: activeStakeSum.toString(),
            activeDelegationSum: activeDelegationSum.toString(),
            activeCombinedSum: activeCombinedSum.toString(),
            frozenStakeSum: frozenStakeSum.toString(),
            frozenDelegationSum: frozenDelegationSum.toString(),
            frozenCombinedSum: frozenCombinedSum.toString(),
            jailedStakeSum: jailedStakeSum.toString(),
            jailedDelegationSum: jailedDelegationSum.toString(),
            jailedCombinedSum: jailedCombinedSum.toString()
        };
    }

    // Create an empty response when no data is available
    private createEmptyResponse(): ProviderStakesAndDelegationData {
        return {
            stakeSum: "0",
            delegationSum: "0",
            stakeTotalSum: "0",
            summary: {
                totalStakeSum: "0",
                totalDelegationSum: "0",
                totalCombinedSum: "0",
                activeStakeSum: "0",
                activeDelegationSum: "0",
                activeCombinedSum: "0",
                frozenStakeSum: "0",
                frozenDelegationSum: "0",
                frozenCombinedSum: "0",
                jailedStakeSum: "0",
                jailedDelegationSum: "0",
                jailedCombinedSum: "0"
            },
            providerStakes: {},
            detailedProviderStakes: {},
            detailedSpecStakes: {}
        };
    }
}

export const ProviderStakesAndDelegationService = new ProviderStakesAndDelegationResource();