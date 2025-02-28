import { desc, sql, eq, inArray, gte, and, gt } from 'drizzle-orm';
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
import { ActiveProvidersService } from '@jsinfo/redis/resources/active/ActiveProvidersResource';

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

// Add this interface to represent rewards data
export interface RewardsData {
    lava: string;  // Rewards in LAVA
    usd: string;   // Rewards in USD equivalent
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

// Keep only these type definitions
type BasicStakesResult = {
    provider: string | null;
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

type ProviderHealthData = Record<string, Record<string, HealthData | string>>;
type ProviderAvatars = Map<string, string>;

// Define the possible reward data type from mainnet
interface EstimatedRewardsData {
    data: {
        providers: Array<{
            address: string;
            rewards_by_block: Record<string, any>;
        }>;
        timestamp: number;
        total_providers: number;
        providers_with_rewards: number;
    };
}

export class ProviderStakesAndDelegationResource extends RedisResourceBase<ProviderStakesAndDelegationData, {}> {
    protected readonly redisKey = 'ProviderStakesAndDelegationResource_v8';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    // Main fetch method
    protected async fetchFromSource(): Promise<ProviderStakesAndDelegationData> {
        try {
            logger.info("Fetching provider stakes and delegation data from source");

            // Fetch active providers first
            const activeProviders = await ActiveProvidersService.fetch();

            // Extract provider addresses
            const providerAddresses = activeProviders && activeProviders.length > 0
                ? activeProviders.map(p => p.provider).filter(p => !!p) as string[]
                : [];

            if (providerAddresses.length === 0) {
                logger.warn("No active providers found, fetching all providers");
            }

            // Fetch rewards data outside the Promise.all for clarity
            let rewardsData: GetResourceResponse | null = null;
            if (IsMainnet()) {
                rewardsData = await MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest_distributed' });
            }

            // Then use these addresses in all the queries
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

            // Convert map to object using a more direct approach
            const avatars: Record<string, string> = {};
            avatarMap.forEach((value, key) => {
                avatars[key] = value;
            });

            // Add type assertions for the metrics maps
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

            // Process the basic stakes data
            const { stakeSum, delegationSum, providerStakes } = this.processBasicStakesData(stakesRes);

            // Pass the health data to the detailed stakes processing
            const { detailedProviderStakes, detailedSpecStakes } =
                await this.processDetailedStakes(
                    detailedStakesRes,
                    aggRes90DaysMap,
                    aggRes30DaysMap,
                    providerHealthData,
                    avatars,
                    rewardsData != null ? rewardsData.data : null
                );

            // Generate summary 
            const summary = this.createSummary(stakeSum, delegationSum, stakesByStatusRes);

            // Handle case with no data
            if (!stakesRes || stakesRes.length === 0) {
                return this.createEmptyResponse();
            }

            // Return complete data
            return {
                stakeSum: stakeSum.toString(),
                delegationSum: delegationSum.toString(),
                stakeTotalSum: (stakeSum + delegationSum).toString(),
                summary,
                providerStakes,
                detailedProviderStakes,
                detailedSpecStakes
            };

        } catch (error) {
            logger.error("Error fetching provider stakes and delegation:", error);
            return this.createEmptyResponse();
        }
    }

    // Fetch basic stakes data for backward compatibility
    private async fetchBasicStakesData(providerAddresses: string[] = []): Promise<DetailedStakesResult[]> {
        if (providerAddresses.length > 0) {
            return []
        }

        return await queryJsinfo(async (db) => {
            return await db.select({
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
                .orderBy(desc(JsinfoSchema.providerStakes.stake));
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

    // Simplified fetch90DayMetrics using proper Drizzle ORM syntax
    private async fetch90DayMetrics(providerAddresses: string[] = []): Promise<UsageMetrics90Days[]> {
        // Early return if no providers to check
        if (providerAddresses.length === 0) {
            return [];
        }

        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        return await queryJsinfo(db => db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        })
            .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .where(
                and(
                    gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, ninetyDaysAgo),
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, providerAddresses)
                )
            )
            .groupBy(
                JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
            ), 'ProviderStakesAndDelegationResource::fetch90DayMetrics');
    }

    // Simplified fetch30DayMetrics using proper Drizzle ORM syntax
    private async fetch30DayMetrics(providerAddresses: string[] = []): Promise<UsageMetrics30Days[]> {
        // Early return if no providers to check
        if (providerAddresses.length === 0) {
            return [];
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        return await queryJsinfo(db => db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        })
            .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .where(
                and(
                    gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, thirtyDaysAgo),
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, providerAddresses)
                )
            )
            .groupBy(
                JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                JsinfoProviderAgrSchema.aggDailyRelayPayments.specId
            ), 'ProviderStakesAndDelegationResource::fetch30DayMetrics');
    }

    // Update the fetchProviderHealth method to simplify the data structure
    private async fetchProviderHealth(providerAddresses: string[] = []): Promise<ProviderHealthData> {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

        const healthResults = await queryJsinfo(db => db.select()
            .from(JsinfoSchema.providerHealth)
            .where(
                sql`${JsinfoSchema.providerHealth.timestamp} >= ${fourHoursAgo} AND 
                    ${JsinfoSchema.providerHealth.provider} IN (${providerAddresses.length > 0 ? providerAddresses : sql`SELECT provider FROM provider_stakes`})`
            )
            .orderBy(desc(JsinfoSchema.providerHealth.timestamp)),
            'ProviderStakesAndDelegationResource::fetchProviderHealth'
        );

        // Transform raw results into the expected structure
        const healthData: ProviderHealthData = {};

        for (const record of healthResults) {
            if (record.provider && record.spec) {
                if (!healthData[record.provider]) {
                    healthData[record.provider] = {};
                }

                // Create HealthData object from record
                const healthInfo: HealthData = {
                    overallStatus: record.status || 'unknown',
                    interfaces: record.interface ? [record.interface] : [],
                    lastTimestamp: record.timestamp.toISOString(),
                    interfaceDetails: {}
                };

                if (record.interface) {
                    healthInfo.interfaceDetails[record.interface] = {
                        status: record.status || 'unknown',
                        message: record.data || '',
                        timestamp: record.timestamp.toISOString(),
                        region: record.geolocation || 'unknown'
                    };
                }

                healthData[record.provider][record.spec] = healthInfo;
            }
        }

        return healthData;
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
        providerHealthMap: Record<string, Record<string, HealthData | string>>,
        avatars: Record<string, string>,
        rewardsData: EstimatedRewardsData | null
    ): Promise<{ detailedProviderStakes: Record<string, DetailedStakeInfo[]>; detailedSpecStakes: Record<string, DetailedStakeInfo[]> }> {
        const detailedProviderStakes: Record<string, DetailedStakeInfo[]> = {};
        const detailedSpecStakes: Record<string, DetailedStakeInfo[]> = {};

        // Create a map for quick rewards lookups if data exists
        const rewardsMap = new Map<string, RewardsData>();
        if (rewardsData && rewardsData.data && rewardsData.data.providers) {
            rewardsData.data.providers.forEach((provider) => {
                if (provider.address && provider.rewards_by_block) {
                    // Get the first block (there's typically only one)
                    const blockKey = Object.keys(provider.rewards_by_block)[0];
                    if (blockKey && provider.rewards_by_block[blockKey]?.total) {
                        const totalRewards = provider.rewards_by_block[blockKey].total;

                        // Extract LAVA amount
                        const lavaToken = totalRewards.tokens.find(
                            token => token.display_denom === 'lava'
                        );

                        // Create rewards data
                        rewardsMap.set(provider.address, {
                            lava: lavaToken ? lavaToken.display_amount : "0",
                            usd: totalRewards.total_usd ? `$${totalRewards.total_usd.toFixed(2)}` : "$0.00"
                        });
                    }
                }
            });
        }

        // For non-mainnet environments
        if (!IsMainnet()) {
            // Set a dummy reward for non-mainnet
            rewardsMap.set("example_provider", {
                lava: "not-mainnet",
                usd: "not-mainnet"
            });
        }

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

            // Get moniker data
            const moniker = await ProviderMonikerService.GetMonikerForProvider(item.provider);
            const monikerfull = await ProviderMonikerService.GetMonikerFullDescription(item.provider);

            // Convert spec ID to chain name and get icon
            const chainName = ConvertToChainName(item.specId || '');
            const chainIcon = GetIconForSpec(item.specId || '') || '';

            // Get health data
            let health: HealthData | "No data available" = "No data available";
            if (providerHealthMap[item.provider] && providerHealthMap[item.provider][item.specId]) {
                const healthValue = providerHealthMap[item.provider][item.specId];
                // Only assign if it's a HealthData object, otherwise keep "No data available"
                if (typeof healthValue === 'object') {
                    health = healthValue;
                }
            }

            // Get the provider's avatar
            const providerAvatar = avatars[item.provider] || undefined;

            // Get rewards data if on mainnet or set to "No data available"
            const rewards = rewardsMap.get(item.provider) || "No data available";

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
                rewards,
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