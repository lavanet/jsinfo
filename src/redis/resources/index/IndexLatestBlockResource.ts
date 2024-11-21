import { desc } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface IndexLatestBlockData {
    height: number;
    datetime: number;
}

export class IndexLatestBlockResource extends RedisResourceBase<IndexLatestBlockData, {}> {
    protected readonly redisKey = 'index:latest:block';
    protected readonly ttlSeconds = 60; // 1 minute cache

    protected async fetchFromDb(): Promise<IndexLatestBlockData> {
        const latestDbBlocks = await queryJsinfo(db => db
            .select()
            .from(JsinfoSchema.blocks)
            .orderBy(desc(JsinfoSchema.blocks.height))
            .limit(1),
            'IndexLatestBlockResource::fetchFromDb'
        );

        let height = 0;
        let datetime = 0;
        if (latestDbBlocks.length != 0) {
            height = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height;
            datetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime();
        }

        return { height, datetime };
    }
}