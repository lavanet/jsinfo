import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { gt, sql } from 'drizzle-orm';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { EstimatedRewardsResponse } from '@jsinfo/indexer/classes/RpcOnDemandEndpointCache';

interface AllAprProviderData {
    address: string;
    moniker: string;
    apr: string;
    commission: string;
    '30_days_cu_served': string;
    tokens: EstimatedRewardsResponse;
}

export class AllProviderAPRResource extends RedisResourceBase<AllAprProviderData[], {}> {
    protected readonly redisKey = 'allProviderAPR';
    protected readonly ttlSeconds = 300; // 5 minutes cache

    protected async fetchFromDb(): Promise<AllAprProviderData[]> {
        const result = await queryJsinfo(async (db) => {
            const addressAndApr = db.select({
                address: JsinfoSchema.aprPerProvider.provider,
                apr: JsinfoSchema.aprPerProvider.value,
                tokens: sql<EstimatedRewardsResponse>`${JsinfoSchema.aprPerProvider.estimatedRewards}`
            }).from(JsinfoSchema.aprPerProvider);

            // Select commissions for all providers in one query
            const providerCommissions = db.select({
                provider: JsinfoSchema.providerStakes.provider,
                commission: sql<number>`AVG(CASE WHEN ${JsinfoSchema.providerStakes.delegateCommission} IS NOT NULL AND ${JsinfoSchema.providerStakes.delegateCommission} > 0 THEN ${JsinfoSchema.providerStakes.delegateCommission} END)`
            }).from(JsinfoSchema.providerStakes)
                .groupBy(JsinfoSchema.providerStakes.provider); // Group by provider to get average commissions

            const cuServed = db.select({
                provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
                relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
            }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider)
                .where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`));

            // do it here
            const fetchData = async () => {
                return Promise.all([addressAndApr, providerCommissions, cuServed]);
            };
            const [addressAndAprData, providerCommissionsData, cuServedData] = await fetchData();

            const providerCommissionsDataMapByProviderId = providerCommissionsData.reduce((acc, curr) => {
                if (curr.provider) {
                    acc[curr.provider] = curr.commission;
                }
                return acc;
            }, {});

            const cuServedDataMapByProviderId = cuServedData.reduce((acc, curr) => {
                if (curr.provider) {
                    acc[curr.provider] = curr.cuSum;
                }
                return acc;
            }, {});

            // build the result AllAprProviderData[]
            return Promise.all(addressAndAprData.map(async (record, index) => ({
                address: record.address,
                moniker: await ProviderMonikerService.GetMonikerForProvider(record.address),
                apr: String(record.apr),
                commission: providerCommissionsDataMapByProviderId[record.address] || null,
                '30_days_cu_served': cuServedDataMapByProviderId[record.address] || null,
                tokens: record.tokens
            })));
        }, `ProviderAPRResource::fetchFromDb`);

        return result;
    }
}