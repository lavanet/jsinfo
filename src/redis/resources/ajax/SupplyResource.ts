import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
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

    protected async fetchFromDb(args: SupplyArgs): Promise<SupplyData> {
        const result = await queryJsinfo(db => db
            .select({ amount: JsinfoSchema.supply.amount })
            .from(JsinfoSchema.supply)
            .where(eq(JsinfoSchema.supply.key, args.type)),
            `SupplyResource::fetchFromDb_${args.type}`
        );

        if (result.length > 0 && result[0].amount) {
            const amount = BigInt(result[0].amount) / BigInt(1000000);
            return { amount: amount.toString() };
        }

        return { amount: "0" };
    }
}