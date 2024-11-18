import { sql, gt } from "drizzle-orm";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';

export interface IndexTopChainsData {
    allSpecs: {
        chainId: string;
        relaySum: number;
        cuSum: number;
    }[];
}

export class IndexTopChainsResource extends RedisResourceBase<IndexTopChainsData, {}> {
    protected readonly redisKey = 'index:top:chains';
    protected readonly ttlSeconds = 300; // 5 minutes cache

    protected async fetchFromDb(db: PostgresJsDatabase): Promise<IndexTopChainsData> {
        const topSpecs = await db.select({
            chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) as relaySum`,
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}) as cuSum`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`)
            .where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`))
            .orderBy(sql`relaySum DESC`);

        return {
            allSpecs: topSpecs.filter((spec): spec is { chainId: string; relaySum: number; cuSum: number; } =>
                spec.chainId !== null
            )
        };
    }
} 