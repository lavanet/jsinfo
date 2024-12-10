import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt } from "drizzle-orm";
import { queryJsinfo } from '@jsinfo/utils/db';

export interface Index30DayCuData {
    cuSum30Days: number;
    relaySum30Days: number;
}

// No args needed for this resource, using void
export class Index30DayCuResource extends RedisResourceBase<Index30DayCuData, {}> {
    protected readonly redisKey = 'index:30day:cu';
    protected readonly cacheExpirySeconds = 3600; // 1 hour cache

    protected async fetchFromSource(): Promise<Index30DayCuData> {
        let res30Days = await queryJsinfo(
            async (db: PostgresJsDatabase) => db.select({
                cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
                relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
            }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
                where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`),
                ),
            'Index30DayCuResource_fetchFromSource'
        );

        const cuSum30Days = res30Days[0]?.cuSum || 0;
        const relaySum30Days = res30Days[0]?.relaySum || 0;

        return {
            cuSum30Days,
            relaySum30Days,
        };
    }
} 