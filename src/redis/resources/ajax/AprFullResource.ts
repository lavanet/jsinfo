import { RedisResourceBase } from '../../classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export interface AprFullData {
    [type: string]: {
        [address: string]: string  // Just the value, no timestamp
    }
}

export class AprFullResource extends RedisResourceBase<AprFullData, {}> {
    protected redisKey = 'apr_full';
    protected ttlSeconds = 600; // 10 minutes cache

    protected async fetchFromDb(): Promise<AprFullData> {
        const result = await queryJsinfo(async (db: PostgresJsDatabase) => {
            return await db
                .select()
                .from(JsinfoSchema.aprFullInfo);
        }, `AprFullResource::fetchFromDb`);

        const aprFullData: AprFullData = {};
        result.forEach(row => {
            if (!aprFullData[row.type]) {
                aprFullData[row.type] = {};
            }
            aprFullData[row.type][row.address] = row.value;
        });

        return aprFullData;
    }
} 