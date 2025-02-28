import { desc, sql, eq, inArray, gte } from 'drizzle-orm';
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

    // Replace the current health fields with a structured object
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

// Add these interfaces near the top with your other interfaces
interface UsageMetrics30Days {
    provider: string;
    specId: string;
    cuSum30Days: number;
    relaySum30Days: number;
}

interface UsageMetrics90Days {
    provider: string;
    specId: string;
    cuSum90Days: number;
    relaySum90Days: number;
}

// Add this interface to properly type the status data
export interface StakesByStatus {
    status: number | null;
    stake: bigint;
    delegateTotal: bigint;
}

export class ProviderStakesAndDelegationResource extends RedisResourceBase<ProviderStakesAndDelegationData, {}> {
    protected readonly redisKey = 'ProviderStakesAndDelegationResource_v8';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    // Main fetch method
    protected async fetchFromSource(): Promise<ProviderStakesAndDelegationData> {
        try {
            logger.info("Fetching provider stakes and delegation data from source");

            // Fetch all required data, now including avatars
            const [stakesRes, stakesByStatusRes, detailedStakesRes, aggRes90Days, aggRes30Days, providerHealthData, avatarMap] = await Promise.all([
                this.fetchBasicStakesData(),
                this.fetchStakesByStatus(),
                this.fetchDetailedStakes(),
                this.fetch90DayMetrics(),
                this.fetch30DayMetrics(),
                this.fetchProviderHealth(),
                GetAllProviderAvatars()  // Add this to fetch avatars
            ]);

            // Convert map to a more convenient object
            const avatars = Object.fromEntries(avatarMap);

            // Create usage metrics maps with filtering and type assertion
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
                await this.processDetailedStakes(detailedStakesRes, aggRes90DaysMap, aggRes30DaysMap, providerHealthData, avatars);

            // Generate summary
            const summary = this.createSummary(stakeSum, delegationSum, stakesByStatusRes);

            // Handle case with no data
            if (!stakesRes || stakesRes.length === 0) {
                return this.createEmptyResponse();
            }

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
            logger.error(`Error in ProviderStakesAndDelegationResource.fetchFromSource: ${error}`);
            throw error;
        }
    }

    // Fetch basic stakes data for backward compatibility
    private async fetchBasicStakesData() {
        return await queryJsinfo(db => db.select({
            provider: JsinfoSchema.providerStakes.provider,
            stake: sql<bigint>`sum(${JsinfoSchema.providerStakes.stake})`,
            delegateTotal: sql<bigint>`sum(${JsinfoSchema.providerStakes.delegateTotal})`,
        })
            .from(JsinfoSchema.providerStakes).groupBy(JsinfoSchema.providerStakes.provider),
            'ProviderStakesAndDelegationResource::fetchBasicStakesData'
        );
    }

    // Fetch stakes broken down by status
    private async fetchStakesByStatus(): Promise<StakesByStatus[]> {
        return await queryJsinfo(db => db.select({
            status: JsinfoSchema.providerStakes.status,
            stake: sql<bigint>`sum(${JsinfoSchema.providerStakes.stake})`,
            delegateTotal: sql<bigint>`sum(${JsinfoSchema.providerStakes.delegateTotal})`
        })
            .from(JsinfoSchema.providerStakes)
            .where(inArray(JsinfoSchema.providerStakes.status, [
                JsinfoSchema.LavaProviderStakeStatus.Active,
                JsinfoSchema.LavaProviderStakeStatus.Frozen,
                JsinfoSchema.LavaProviderStakeStatus.Jailed
            ]))
            .groupBy(JsinfoSchema.providerStakes.status),
            'ProviderStakesAndDelegationResource::fetchStakesByStatus'
        );
    }

    // Fetch detailed stake information
    private async fetchDetailedStakes() {
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
            .orderBy(desc(JsinfoSchema.providerStakes.stake)),
            'ProviderStakesAndDelegationResource::fetchDetailedStakes'
        );
    }

    // Fetch 90-day usage metrics
    private async fetch90DayMetrics() {
        return await queryJsinfo(db => db.select({
            provider: JsinfoSchema.providerStakes.provider,
            specId: JsinfoSchema.providerStakes.specId,
            cuSum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, sql`
                ${JsinfoSchema.providerStakes.provider} = ${JsinfoProviderAgrSchema.aggDailyRelayPayments.provider} AND
                ${JsinfoSchema.providerStakes.specId} = ${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId} AND
                ${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday} > now() - interval '90 day'
            `)
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId),
            'ProviderStakesAndDelegationResource::fetch90DayMetrics'
        );
    }

    // Fetch 30-day usage metrics
    private async fetch30DayMetrics() {
        return await queryJsinfo(db => db.select({
            provider: JsinfoSchema.providerStakes.provider,
            specId: JsinfoSchema.providerStakes.specId,
            cuSum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, sql`
                ${JsinfoSchema.providerStakes.provider} = ${JsinfoProviderAgrSchema.aggDailyRelayPayments.provider} AND
                ${JsinfoSchema.providerStakes.specId} = ${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId} AND
                ${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday} > now() - interval '30 day'
            `)
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId),
            'ProviderStakesAndDelegationResource::fetch30DayMetrics'
        );
    }

    // Update the fetchProviderHealth method to simplify the data structure
    private async fetchProviderHealth(): Promise<Record<string, Record<string, HealthData | string>>> {
        const fourHoursAgo = new Date();
        fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

        // Fetch all health records for the past four hours
        const healthData = await queryJsinfo(db => db.select()
            .from(JsinfoSchema.providerHealth)
            .where(gte(JsinfoSchema.providerHealth.timestamp, fourHoursAgo))
            .orderBy(desc(JsinfoSchema.providerHealth.timestamp)),
            'ProviderStakesAndDelegationResource::fetchProviderHealth'
        );

        // Organize by provider -> spec -> interface
        const providerHealthMap: Record<string, Record<string, HealthData | string>> = {};

        // First, organize health records by provider, spec, interface
        const latestRecords = new Map<string, any>(); // key: provider:spec:interface

        for (const record of healthData) {
            const { provider, spec, interface: iface, geolocation, status, timestamp, data } = record;

            if (!provider || !spec || !iface) continue;

            const key = `${provider}:${spec}:${iface}`;

            // Keep only the newest record for each provider-spec-interface
            if (!latestRecords.has(key) || latestRecords.get(key).timestamp < timestamp) {
                latestRecords.set(key, {
                    provider,
                    spec,
                    interface: iface,
                    geolocation, // We'll still track this but won't prioritize by it
                    status,
                    timestamp,
                    data
                });
            }
        }

        // Now process the latest records
        for (const record of latestRecords.values()) {
            const { provider, spec, interface: iface, status, timestamp, data } = record;

            // Initialize provider map if needed
            if (!providerHealthMap[provider]) {
                providerHealthMap[provider] = {};
            }

            // Initialize spec data if needed
            if (!providerHealthMap[provider][spec] || providerHealthMap[provider][spec] === "No data available") {
                providerHealthMap[provider][spec] = {
                    overallStatus: 'unknown',
                    interfaces: [],
                    lastTimestamp: timestamp.toISOString(),
                    interfaceDetails: {}
                };
            }

            // Skip if we've marked this as "No data available"
            if (typeof providerHealthMap[provider][spec] === 'string') continue;

            const healthObj = providerHealthMap[provider][spec] as HealthData;

            // Add interface to list if not already there
            if (!healthObj.interfaces.includes(iface)) {
                healthObj.interfaces.push(iface);
            }

            // Update with the latest status - now directly in interfaceDetails
            if (!healthObj.interfaceDetails) {
                healthObj.interfaceDetails = {};
            }

            healthObj.interfaceDetails[iface] = {
                status,
                message: this.parseMessageFromHealth(data) || "N/A",
                timestamp: timestamp.toISOString(),
                region: record.geolocation || "Unknown" // Include the region info
            };

            // Update last timestamp if this is more recent
            if (new Date(healthObj.lastTimestamp) < timestamp) {
                healthObj.lastTimestamp = timestamp.toISOString();
            }
        }

        // Calculate overall status and format timestamps
        for (const provider in providerHealthMap) {
            for (const spec in providerHealthMap[provider]) {
                // Skip if marked as "No data available"
                if (typeof providerHealthMap[provider][spec] === 'string') continue;

                const healthObj = providerHealthMap[provider][spec] as HealthData;

                // Get unique statuses from all interfaces
                const statuses = Object.values(healthObj.interfaceDetails)
                    .map(data => data.status);

                // Determine overall status
                if (statuses.length === 0) {
                    providerHealthMap[provider][spec] = "No data available";
                } else if (statuses.every(status => status === 'healthy')) {
                    healthObj.overallStatus = 'healthy';
                } else if (statuses.every(status => status === 'unhealthy')) {
                    healthObj.overallStatus = 'unhealthy';
                } else if (statuses.every(status => status === 'frozen')) {
                    healthObj.overallStatus = 'frozen';
                } else if (statuses.every(status => status === 'jailed')) {
                    healthObj.overallStatus = 'jailed';
                } else if (statuses.some(status =>
                    status === 'frozen' ||
                    status === 'unhealthy' ||
                    status === 'jailed'
                )) {
                    healthObj.overallStatus = 'degraded';
                }

                // Format the timestamp for UI display
                healthObj.lastTimestamp = this.formatTimestampForUI(new Date(healthObj.lastTimestamp));

                // Format all interface timestamps
                for (const iface in healthObj.interfaceDetails) {
                    const interfaceData = healthObj.interfaceDetails[iface];
                    interfaceData.timestamp = this.formatTimestampForUI(new Date(interfaceData.timestamp));
                }

                // Sort interfaces alphabetically
                healthObj.interfaces.sort();
            }
        }

        return providerHealthMap;
    }

    // Add helper method to format timestamps consistently
    private formatTimestampForUI(date: Date): string {
        return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
    }

    // Parse health message from health data
    private parseMessageFromHealth(data: string | null): string {
        if (!data) return "";
        try {
            const parsedData = JSON.parse(data);

            if (parsedData.message) {
                return parsedData.message;
            }

            if (parsedData.jail_end_time && parsedData.jails) {
                const date = new Date(parsedData.jail_end_time);
                // Skip bad data
                if (date.getFullYear() === 1970) return "";
                let formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                return `Jail end time: ${formattedDate}, Jails: ${parsedData.jails}`;
            }

            if (parsedData.block && parsedData.others) {
                const blockMessage = `Block: 0x${(parsedData.block).toString(16)}`;
                const latestBlock = parsedData.others;
                let finalMessage = `${blockMessage}, Others: 0x${(latestBlock).toString(16)}`;

                if (parsedData.latency) {
                    const latencyInMs = parsedData.latency / 1000000;
                    finalMessage += `. Latency: ${latencyInMs.toFixed(0)}ms`;
                }

                return finalMessage;
            }

            return "";
        } catch (e) {
            logger.error('parseMessageFromHealth - failed parsing data:', e);
            return "";
        }
    }

    // Process basic stakes data
    private processBasicStakesData(stakesRes: any[]) {
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
        detailedStakesRes: any[],
        aggRes90DaysMap: Map<string, UsageMetrics90Days>,
        aggRes30DaysMap: Map<string, UsageMetrics30Days>,
        providerHealthMap: Record<string, Record<string, HealthData | string>>,
        avatars: Record<string, string>
    ) {
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

            // Get moniker data
            const moniker = await ProviderMonikerService.GetMonikerForProvider(item.provider);
            const monikerfull = await ProviderMonikerService.GetMonikerFullDescription(item.provider);

            // Convert spec ID to chain name and get icon
            const chainName = ConvertToChainName(item.specId || '');
            const chainIcon = GetIconForSpec(item.specId || '') || '';

            // Get health data
            let health: HealthData | "No data available" = "No data available";
            if (providerHealthMap[item.provider] && providerHealthMap[item.provider][item.specId]) {
                health = providerHealthMap[item.provider][item.specId];
            }

            // Get the provider's avatar
            const providerAvatar = avatars[item.provider] || undefined;

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

                // New structured health data
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