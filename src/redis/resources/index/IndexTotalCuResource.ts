import { sql } from 'drizzle-orm';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface IndexTotalCuData {
    cuSum: number;
    relaySum: number;
}

export class IndexTotalCuResource extends RedisResourceBase<IndexTotalCuData, {}> {
    protected readonly redisKey = 'index:total:cu';
    protected readonly cacheExpirySeconds = 3600; // 1 hour cache

    protected async fetchFromSource(): Promise<IndexTotalCuData> {
        const res = await queryJsinfo<{ cuSum: number; relaySum: number }[]>(
            async (db) => await db.select({
                cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
                relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
            }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments),
            'IndexTotalCuResource_fetchFromSource'
        );

        return {
            cuSum: res[0]?.cuSum ?? 0,
            relaySum: res[0]?.relaySum ?? 0,
        };
    }
} 