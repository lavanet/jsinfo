import { desc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { MinBigInt } from '@jsinfo/utils/bigint';

export interface IndexStakesData {
    stakeSum: string;
}

export class IndexStakesResource extends RedisResourceBase<IndexStakesData, {}> {
    protected readonly redisKey = 'index:stakes';
    protected readonly ttlSeconds = 600; // 10 minutes cache

    protected async fetchFromDb(): Promise<IndexStakesData> {
        const stakesRes = await db
            .select({
                stake: JsinfoSchema.providerStakes.stake,
                delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
                delegateLimit: JsinfoSchema.providerStakes.delegateLimit,
            })
            .from(JsinfoSchema.providerStakes)
            .orderBy(desc(JsinfoSchema.providerStakes.stake));

        let stakeSum = 0n;
        stakesRes.forEach((stake) => {
            stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
        });

        return {
            stakeSum: stakeSum.toString(),
        };
    }
} 