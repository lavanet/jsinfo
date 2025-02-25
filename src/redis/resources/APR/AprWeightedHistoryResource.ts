import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { RedisCache } from '../../classes/RedisCache';
import { logger } from '@jsinfo/utils/logger';
import { AprHistoryEntry, AprWeighted, ReturnedAprRecord } from './AprWeighted';

export class AprWeightedHistoryResource extends RedisResourceBase<ReturnedAprRecord[], {}> {
    protected redisKey = 'apr_weighted_histories';
    protected cacheExpirySeconds = 3600; // 1 hour cache

    protected async fetchFromSource(): Promise<ReturnedAprRecord[]> {
        try {
            const keys = await RedisCache.getKeysByPrefix(AprWeighted.KEY_PREFIX);
            const allHistories: ReturnedAprRecord[] = [];

            for (const key of keys) {
                const historyStr = await RedisCache.get(key);
                if (!historyStr) continue;

                const history: AprHistoryEntry = JSON.parse(historyStr);
                const records = history.records.map(record => ({
                    date: record.date,
                    apr: record.aprSum / record.count,
                    source: record.source,
                    address: record.address
                }));

                allHistories.push(...records);
            }

            return allHistories.sort((a, b) => b.date.localeCompare(a.date));
        } catch (error) {
            logger.error('Failed to get all APR histories:', error);
            return [];
        }
    }
}

export const AprWeightedHistoryService = new AprWeightedHistoryResource();