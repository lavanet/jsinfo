import { RedisCache } from '../../classes/RedisCache';
import { logger } from '@jsinfo/utils/logger';
import Decimal from 'decimal.js';

const WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.05, 0.03, 0.02];
const DAYS_TO_KEEP = 7;
const REDIS_EXPIRY = 30 * 24 * 60 * 60; // 30 days

// Type for storing APR data
interface StoredAprRecord {
    date: string;      // Format: "YYYY/MM/DD"
    aprSum: number;
    count: number;
    source: 'validator' | 'provider';
    address: string;
}

// Type for returning APR data
interface ReturnedAprRecord {
    date: string;
    apr: number;
    source: 'validator' | 'provider';
    address: string;
}

interface AprHistoryEntry {
    records: StoredAprRecord[];
    lastUpdated: string;
}

export class AprWeighted {
    private static readonly KEY_PREFIX = 'apr_history:';

    private static getRedisKey(source: string, address: string): string {
        return `${this.KEY_PREFIX}${source}:${address}`;
    }

    private static formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}/${month}/${day}`;
    }

    static async StoreApr(params: {
        apr: number,
        source: 'validator' | 'provider',
        address: string
    }): Promise<void> {
        const { apr, source, address } = params;
        const redisKey = this.getRedisKey(source, address);
        const today = this.formatDate(new Date());

        try {
            const historyStr = await RedisCache.get(redisKey);
            const history: AprHistoryEntry = historyStr ?
                JSON.parse(historyStr) :
                { records: [], lastUpdated: today };

            let todayRecord = history.records.find(r => r.date === today);
            if (todayRecord) {
                todayRecord.aprSum += apr;
                todayRecord.count += 1;
            } else {
                history.records.push({
                    date: today,
                    aprSum: apr,
                    count: 1,
                    source,
                    address
                });
            }

            history.records = history.records
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, DAYS_TO_KEEP);

            history.lastUpdated = today;

            await RedisCache.set(redisKey, JSON.stringify(history), REDIS_EXPIRY);
        } catch (error) {
            logger.error(`Failed to store APR history for ${source}:${address}:`, error);
        }
    }

    static async GetAllAprHistories(): Promise<ReturnedAprRecord[]> {
        try {
            const keys = await RedisCache.getKeysByPrefix(this.KEY_PREFIX);
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

    static async GetWeightedApr(params: {
        source: 'validator' | 'provider',
        address: string
    }): Promise<number | null> {
        const { source, address } = params;
        const redisKey = this.getRedisKey(source, address);

        try {
            const historyStr = await RedisCache.get(redisKey);
            if (!historyStr) {
                return null;
            }

            const history: AprHistoryEntry = JSON.parse(historyStr);
            const records = history.records;

            if (records.length === 0) {
                return null;
            }

            // Calculate weighted average using daily averages
            let weightedSum = new Decimal(0);
            let weightSum = new Decimal(0);

            records.forEach((record, index) => {
                if (index < WEIGHTS.length) {
                    const dailyAverage = record.aprSum / record.count;
                    weightedSum = weightedSum.plus(new Decimal(dailyAverage).times(WEIGHTS[index]));
                    weightSum = weightSum.plus(WEIGHTS[index]);
                }
            });

            return weightSum.isZero() ? null : weightedSum.dividedBy(weightSum).toNumber();

        } catch (error) {
            logger.error(`Failed to get weighted APR for ${source}:${address}:`, error);
            return null;
        }
    }
}
