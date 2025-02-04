import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { and, eq, gt, sql } from 'drizzle-orm';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { EstimatedRewardsResponse } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import Decimal from 'decimal.js';
import { logger } from '@jsinfo/utils/logger';
import { CalculateProviderAprs, ProviderAprDetails, RewardAmount } from '@jsinfo/indexer/restrpc_agregators/CalcualteApr';

export interface AllAprProviderData {
    address: string;
    moniker: string;
    apr?: string | null;
    commission?: string | null;
    '30_days_cu_served'?: string | null;
    '30_days_relays_served'?: string | null;
    rewards_10k_lava_delegation: RewardAmount[];
    relaySum?: number;
}

// Helper function to get commission
function ValueOrDash(provider: string | undefined): string {
    return IsMeaningfulText("" + provider) ? String(provider) : '-';
}

// Helper function to safely format commission
function formatCommissionPrecent(commission: any): string {
    if (!IsMeaningfulText(commission)) return '-';

    try {
        const commissionDecimal = new Decimal(commission);
        if (commissionDecimal.isZero()) return '0.0%';
        return `${commissionDecimal.toFixed(1)}%`;
    } catch (error) {
        return '-';
    }
}

interface AddressAndApr {
    address: string;
    type: string;
    apr: string;
    rewards: EstimatedRewardsResponse;
}

interface ProviderCommission {
    provider: string;
    commission: number; // Assuming commission is a number
}

interface CuServed {
    provider: string;
    cuSum: number; // Assuming cuSum is a number
    relaySum: number; // Assuming relaySum is a number
}

export class AllProviderAPRResource extends RedisResourceBase<AllAprProviderData[], {}> {
    protected readonly redisKey = 'allProviderAPR_v8';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(): Promise<AllAprProviderData[]> {
        const result = await queryJsinfo(async (db) => {
            const [addressAndAprData, providerCommissionsData, cuServedData] = await this.fetchData(db);
            const providerCommissionsDataMapByProviderId = this.mapProviderCommissions(providerCommissionsData);
            const cuServedDataMapByProviderId = this.mapCuServedData(cuServedData);
            const relayServedDataMapByProviderId = this.mapRelayServedData(cuServedData);

            return this.constructProcessedData(
                addressAndAprData,
                providerCommissionsDataMapByProviderId,
                cuServedDataMapByProviderId,
                relayServedDataMapByProviderId
            );
        }, `ProviderAPRResource::fetchFromSource`);

        return result;
    }

    private async fetchData(db: any): Promise<[Record<string, ProviderAprDetails>, ProviderCommission[], CuServed[]]> {
        const addressAndApr = await CalculateProviderAprs();

        const providerCommissions = db.select({
            provider: JsinfoSchema.providerStakes.provider,
            commission: sql`AVG(CASE WHEN ${JsinfoSchema.providerStakes.delegateCommission} IS NOT NULL AND ${JsinfoSchema.providerStakes.delegateCommission} > 0 THEN ${JsinfoSchema.providerStakes.delegateCommission} END)`
        }).from(JsinfoSchema.providerStakes)
            .where(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active))
            .groupBy(JsinfoSchema.providerStakes.provider);

        const cuServed = db.select({
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
            cuSum: sql`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum: sql`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider)
            .where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`));

        return Promise.all([addressAndApr, providerCommissions, cuServed]);
    }

    private mapProviderCommissions(providerCommissionsData: any[]): Record<string, string> {
        // Add logging to debug
        logger.info('Raw provider commissions:', providerCommissionsData);

        const commissionMap = Object.fromEntries(
            providerCommissionsData
                .filter(curr => IsMeaningfulText(curr.provider))
                .map(curr => {
                    const provider = curr.provider.toLowerCase().trim();
                    const commission = formatCommissionPrecent(curr.commission);
                    // Log each mapping
                    logger.info(`Mapping commission for ${provider}: ${commission}`);
                    return [provider, commission];
                })
        );

        // Log final map
        logger.info('Final commission map:', commissionMap);
        return commissionMap;
    }

    private mapCuServedData(cuServedData: CuServed[]): Record<string, number> {
        const cuServedDataMapByProviderId: Record<string, number> = {};
        for (const curr of cuServedData) {
            if (!IsMeaningfulText(curr.provider) || curr.provider === null) continue;
            const provider = curr.provider!.toLowerCase().trim();
            if (!cuServedDataMapByProviderId[provider]) {
                cuServedDataMapByProviderId[provider] = 0; // Initialize if not present
            }
            cuServedDataMapByProviderId[provider] += parseInt("" + curr.cuSum); // Sum cuSum for the same provider
        }
        return cuServedDataMapByProviderId;
    }

    private mapRelayServedData(cuServedData: CuServed[]): Record<string, number> {
        const cuServedDataMapByProviderId: Record<string, number> = {};
        for (const curr of cuServedData) {
            if (!IsMeaningfulText(curr.provider) || curr.provider === null) continue;
            const provider = curr.provider!.toLowerCase().trim();
            if (!cuServedDataMapByProviderId[provider]) {
                cuServedDataMapByProviderId[provider] = 0; // Initialize if not present
            }
            cuServedDataMapByProviderId[provider] += parseInt("" + curr.relaySum); // Sum cuSum for the same provider
        }
        return cuServedDataMapByProviderId;
    }

    private async constructProcessedData(
        addressAndAprData: Record<string, ProviderAprDetails>,
        providerCommissionsDataMapByProviderId: Record<string, string>,
        cuServedDataMapByProviderId: Record<string, number>,
        relayServedDataMapByProviderId: Record<string, number>
    ): Promise<AllAprProviderData[]> {
        const processedAddressAndAprData: AllAprProviderData[] = [];
        const entries = Object.keys(addressAndAprData);

        logger.info(`Constructing data for ${entries.length} providers`);

        for (const address of entries) {
            const normalizedAddress = address.toLowerCase().trim();
            const commission = providerCommissionsDataMapByProviderId[normalizedAddress];
            logger.info(`Looking up commission for ${normalizedAddress}: ${commission}`);

            const moniker = await ProviderMonikerService.GetMonikerForProvider(address);
            const details = addressAndAprData[address];

            const ret: AllAprProviderData = {
                address: address,
                moniker: ValueOrDash(moniker),
                apr: details.apr,
                commission: commission || '-', // Provide default if not found
                '30_days_cu_served': ValueOrDash(String(cuServedDataMapByProviderId[normalizedAddress])),
                '30_days_relays_served': ValueOrDash(String(relayServedDataMapByProviderId[normalizedAddress])),
                rewards_10k_lava_delegation: details.rewards_10k_lava_delegation,
            };

            processedAddressAndAprData.push(ret);
        }

        logger.info(`Processed ${processedAddressAndAprData.length} providers total`);
        return processedAddressAndAprData;
    }
}