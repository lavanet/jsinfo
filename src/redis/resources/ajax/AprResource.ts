import { RedisResourceBase } from '../../classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface AprData {
    [key: string]: number;
}

export class AprResource extends RedisResourceBase<AprData, {}> {
    protected redisKey = 'apr';
    protected ttlSeconds = 600; // 10 minutes cache

    protected async fetchFromDb(db: PostgresJsDatabase): Promise<AprData> {
        const result = await db
            .select({ key: JsinfoSchema.apr.key, value: JsinfoSchema.apr.value })
            .from(JsinfoSchema.apr);

        const aprData: AprData = {};
        result.forEach(row => {
            aprData[row.key] = row.value;
        });

        return aprData;
    }
} 