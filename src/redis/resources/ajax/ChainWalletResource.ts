import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { eq } from 'drizzle-orm';

export interface ChainWalletData {
    total: string;
    monthly: string;
}

interface ChainWalletArgs {
    type: 'stakers' | 'restakers';
}

export class ChainWalletResource extends RedisResourceBase<ChainWalletData, ChainWalletArgs> {
    protected readonly redisKey = 'chain_wallet';
    protected readonly ttlSeconds = 300; // 5 minutes cache

    protected async fetchFromDb(args: ChainWalletArgs): Promise<ChainWalletData> {
        const prefix = args.type === 'stakers' ? 'stakers' : 'restakers';

        const totalResult = await queryJsinfo(db => db
            .select({ value: JsinfoSchema.keyValueStore.value })
            .from(JsinfoSchema.keyValueStore)
            .where(eq(JsinfoSchema.keyValueStore.key, `${prefix}_current_unique_delegators`)),
            `ChainWalletResource::fetchFromDb_${args.type}`
        );

        const monthlyResult = await queryJsinfo(db => db
            .select({ value: JsinfoSchema.keyValueStore.value })
            .from(JsinfoSchema.keyValueStore)
            .where(eq(JsinfoSchema.keyValueStore.key, `${prefix}_monthly_unique_delegators`)),
            `ChainWalletResource::fetchFromDb_${args.type}`
        );

        return {
            total: totalResult[0]?.value?.toString() || "0",
            monthly: monthlyResult[0]?.value?.toString() || "0"
        };
    }
} 