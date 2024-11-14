import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { QueryGetJsinfoDbForQueryInstance } from '../../../query/queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from 'drizzle-orm';

interface SupplyData {
    amount: string;
}

interface SupplyArgs {
    type: 'total' | 'circulating';
}

export class SupplyResource extends RedisResourceBase<SupplyData, SupplyArgs> {
    protected readonly redisKey = 'supply';
    protected readonly ttlSeconds = 300; // 5 minutes cache

    protected async fetchFromDb(_db: PostgresJsDatabase, args: SupplyArgs): Promise<SupplyData> {
        const result = await QueryGetJsinfoDbForQueryInstance()
            .select({ amount: JsinfoSchema.supply.amount })
            .from(JsinfoSchema.supply)
            .where(eq(JsinfoSchema.supply.key, args.type));

        if (result.length > 0 && result[0].amount) {
            const amount = BigInt(result[0].amount) / BigInt(1000000);
            return { amount: amount.toString() };
        }

        return { amount: "0" };
    }
}