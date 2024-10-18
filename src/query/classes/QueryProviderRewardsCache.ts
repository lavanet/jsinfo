// src/query/classes/ProviderRewardsCache.ts

import { QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { and, like, sql } from 'drizzle-orm';
import { IsIndexerProcess, ParseUlavaToBigInt, logger, Sleep } from '../../utils/utils';
import { JSONStringifySpaced } from '../../utils/utils';
import { GetJsinfoDb } from '../../utils/dbUtils';

export class RewardsCache {
    private allRewards: Record<string, bigint> = {};
    private rewardsLast30Days: Record<string, bigint> = {};
    private refreshInterval: number = 2 * 60 * 1000;
    private isRefreshing: boolean = false;
    private refreshPromise: Promise<void> | null = null;

    constructor() {
        this.refreshCache();
        setInterval(() => this.refreshCache(), this.refreshInterval);
    }

    public getAllRewards(): Record<string, bigint> {
        return this.allRewards;
    }

    public getRewardsLast30Days(): Record<string, bigint> {
        return this.rewardsLast30Days;
    }

    private async refreshCache(): Promise<void> {
        if (this.isRefreshing) {
            return this.refreshPromise || Promise.resolve();
        }

        this.isRefreshing = true;
        this.refreshPromise = this._refreshCache();

        try {
            await this.refreshPromise;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    private async _refreshCache(): Promise<void> {
        await QueryCheckJsinfoReadDbInstance();

        const maxRetries = 3;
        let retryCount = 0;
        let lastError: Error | null = null;

        while (retryCount < maxRetries) {
            try {
                const db = await GetJsinfoDb();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                const allRewards: Record<string, bigint> = {};
                const rewardsLast30Days: Record<string, bigint> = {};

                const chunkSize = 500;
                let offset = 0;

                while (true) {
                    const res = await db
                        .select({
                            fulltext: JsinfoSchema.events.fulltext,
                            timestamp: JsinfoSchema.events.timestamp
                        })
                        .from(JsinfoSchema.events)
                        .where(and(like(JsinfoSchema.events.t1, '%lava_delegator_claim_rewards%')))
                        .limit(chunkSize)
                        .offset(offset);

                    if (res.length === 0) {
                        break; // No more results
                    }

                    res.forEach((event) => {
                        if (!event.fulltext) return;
                        const j = JSON.parse(event.fulltext);
                        if (!j.claimed || !j.delegator) return;

                        let ulava = 0n;
                        try {
                            ulava = ParseUlavaToBigInt(j.claimed);
                        } catch (e) {
                            logger.error(`Error parsing claimed amount: ${e}, event: ${JSONStringifySpaced(event)}`);
                            return;
                        }

                        if (typeof ulava !== 'bigint') {
                            throw new TypeError(`Expected ulava to be a bigint, got ${typeof ulava}`);
                        }

                        let provider = j.delegator;
                        if (event.timestamp) {
                            let eventDate = new Date(event.timestamp);
                            if (eventDate >= thirtyDaysAgo) {
                                rewardsLast30Days[provider] = (rewardsLast30Days[provider] || 0n) + ulava;
                            }
                        }

                        allRewards[provider] = (allRewards[provider] || 0n) + ulava;
                    });

                    offset += chunkSize;
                }

                this.allRewards = allRewards;
                this.rewardsLast30Days = rewardsLast30Days;

                logger.info('RewardsCache refresh completed');
                break; // Exit retry loop if successful
            } catch (error) {
                lastError = error as Error;
                logger.error(`Error refreshing rewards cache (attempt ${retryCount + 1}/${maxRetries}):`, lastError);
                retryCount++;

                if (retryCount < maxRetries) {
                    const delay = 1000 * retryCount; // Exponential backoff
                    logger.info(`Retrying in ${delay}ms...`);
                    await Sleep(delay);
                }
            }
        }

        if (retryCount === maxRetries && lastError) {
            logger.error(`Failed to refresh rewards cache after ${maxRetries} attempts`);
            throw lastError;
        }
    }
}

export const ProviderRewardsCache = IsIndexerProcess() ? (null as unknown as RewardsCache) : new RewardsCache();
