import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { logger } from '@jsinfo/utils/logger';
import Decimal from 'decimal.js';

const WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.05, 0.03, 0.02];
const DAYS_TO_KEEP = 7;
const REDIS_EXPIRY = 30 * 24 * 60 * 60; // 30 days

export interface StoredAprRecord {
    date: string;      // Format: "YYYY/MM/DD"
    aprSum: number;
    count: number;
    source: 'validator' | 'provider';
    address: string;
}

export interface ReturnedAprRecord {
    date: string;
    apr: number;
    source: 'validator' | 'provider';
    address: string;
}

export interface AprHistoryEntry {
    records: StoredAprRecord[];
    lastUpdated: string;
}

// Static utility class for APR operations
export class AprWeighted {
    public static readonly KEY_PREFIX = 'apr_history:';

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

        if (apr === 0) return;

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

    static async GetWeightedApr(params: {
        source: 'validator' | 'provider',
        address: string
    }): Promise<number | null> {
        const { source, address } = params;
        const redisKey = this.getRedisKey(source, address);

        try {
            const historyStr = await RedisCache.get(redisKey);
            if (!historyStr) return null;

            const history: AprHistoryEntry = JSON.parse(historyStr);
            if (history.records.length === 0) return null;

            let weightedSum = new Decimal(0);
            let weightSum = new Decimal(0);

            history.records.forEach((record, index) => {
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

