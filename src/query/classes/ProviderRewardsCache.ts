// src/query/classes/ProviderRewardsCache.ts

import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { and, like } from 'drizzle-orm';
import { ParseUlavaToBigInt } from '../../utils/utils';
import { logger } from '../../utils/utils';
import { JSONStringifySpaced } from '../../utils/utils';

export class RewardsCache {
    private allRewards: Record<string, bigint> = {};
    private rewardsLast30Days: Record<string, bigint> = {};

    constructor() {
        this.initRewardsCache();
        setInterval(() => this.initRewardsCache(), 2 * 60 * 1000);
    }

    public getAllRewards(): Record<string, bigint> {
        return this.allRewards;
    }

    public getRewardsLast30Days(): Record<string, bigint> {
        return this.rewardsLast30Days;
    }

    private async initRewardsCache() {
        await QueryCheckJsinfoReadDbInstance();

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let allRewards: Record<string, bigint> = {};
        let rewardsLast30Days: Record<string, bigint> = {};

        const res = await QueryGetJsinfoReadDbInstance()
            .select({
                fulltext: JsinfoSchema.events.fulltext,
                timestamp: JsinfoSchema.events.timestamp
            })
            .from(JsinfoSchema.events)
            .where(
                and(
                    like(JsinfoSchema.events.t1, '%lava_delegator_claim_rewards%')
                ));

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
                    if (!rewardsLast30Days[provider]) {
                        rewardsLast30Days[provider] = 0n;
                    }
                    rewardsLast30Days[provider] += ulava;
                }
            }

            if (!allRewards[provider]) {
                allRewards[provider] = 0n;
            }
            allRewards[provider] += ulava;
        });

        this.allRewards = allRewards;
        this.rewardsLast30Days = rewardsLast30Days;
    }
}

export const ProviderRewardsCache = new RewardsCache();