import { RedisResourceBase } from '../../classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
export interface AprData {
    [key: string]: number;
}

export class AprResource extends RedisResourceBase<AprData, {}> {
    protected redisKey = 'apr';
    protected cacheExpirySeconds = 600; // 10 minutes cache

    protected async fetchFromSource(): Promise<AprData> {
        const result = await queryJsinfo(async (db: PostgresJsDatabase) => {
            return await db
                .select({ key: JsinfoSchema.apr.key, value: JsinfoSchema.apr.value })
                .from(JsinfoSchema.apr);
        }, `AprResource::fetchFromSource`);

        const aprData: AprData = {};
        result.forEach(row => {
            aprData[row.key] = row.value;
        });

        return aprData;
    }
} 