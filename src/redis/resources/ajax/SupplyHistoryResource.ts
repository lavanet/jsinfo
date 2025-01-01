import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { supplyHistory, type SupplyHistory } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';

export class SupplyHistoryResource extends RedisResourceBase<SupplyHistory[], {}> {
    protected readonly redisKey = 'supply-history';
    protected readonly cacheExpirySeconds = 300;

    protected async fetchFromSource(): Promise<SupplyHistory[]> {
        return await queryJsinfo(async (db) => {
            return await db
                .select()
                .from(supplyHistory)
                .orderBy(supplyHistory.createdAt)
                .execute();
        }, 'getSupplyHistory');
    }
}

export const SupplyHistoryService = new SupplyHistoryResource();