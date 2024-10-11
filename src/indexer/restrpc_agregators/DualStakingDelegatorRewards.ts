import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "./utils";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq, and, desc } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { MemoryCache } from "../classes/MemoryCache";
import { performance } from 'perf_hooks';
import { ProviderMonikerCache } from "../classes/IndexerProviderMonikerCache";

interface Delegation {
    provider: string;
    chainID: string;
    delegator: string;
    amount: {
        denom: string;
        amount: string;
    };
    timestamp: string;
}

interface ProviderDelegatorsResponse {
    delegations: Delegation[];
}

interface Reward {
    provider: string;
    chain_id: string;
    amount: {
        denom: string;
        amount: string;
    }[];
}

interface DelegatorRewardsResponse {
    rewards: Reward[];
}

async function GetProviderDelegators(provider: string): Promise<ProviderDelegatorsResponse> {
    return QueryLavaRPC<ProviderDelegatorsResponse>(`/lavanet/lava/dualstaking/provider_delegators/${provider}`);
}

async function GetDelegatorRewards(delegator: string): Promise<DelegatorRewardsResponse> {
    return QueryLavaRPC<DelegatorRewardsResponse>(`/lavanet/lava/dualstaking/delegator_rewards/${delegator}`);
}

export async function ProcessDualStackingDelegatorRewards(db: PostgresJsDatabase): Promise<void> {
    const startTime = performance.now();
    try {
        const cachedDelegators = await MemoryCache.getArray('uniqueDelegators');

        let delegatorsArray: string[];

        if (cachedDelegators) {
            delegatorsArray = cachedDelegators;
        } else {
            const providers = await ProviderMonikerCache.GetAllProviders(db);
            const uniqueDelegators = new Set<string>();

            for (const provider of providers) {
                const delegators = await GetProviderDelegators(provider);

                for (const delegation of delegators.delegations) {
                    if (!IsMeaningfulText(delegation.delegator)) {
                        continue;
                    }
                    uniqueDelegators.add(delegation.delegator);
                }
            }

            delegatorsArray = Array.from(uniqueDelegators);
            await MemoryCache.setArray('uniqueDelegators', delegatorsArray, 3600); // Cache for 1 hour
        }

        for (const delegator of delegatorsArray) {
            await ProcessDelegatorRewards(db, delegator);
        }

        const endTime = performance.now();
        logger.info(`Successfully processed dual stacking delegator rewards for all unique delegators. Time taken: ${(endTime - startTime) / 1000} seconds`);
    } catch (error) {
        logger.error('Error processing dual stacking delegator rewards', { error });
        throw error;
    }
}

async function ProcessDelegatorRewards(db: PostgresJsDatabase, delegator: string): Promise<void> {
    const startTime = performance.now();
    try {
        const rewardsResponse = await GetDelegatorRewards(delegator);

        for (const reward of rewardsResponse.rewards) {
            await ProcessReward(db, reward);
        }

        const endTime = performance.now();
        if ((endTime - startTime) > 1000) {
            logger.info(`ProcessDelegatorRewards for ${delegator} took ${(endTime - startTime) / 1000} seconds`);
        }
    } catch (error) {
        logger.error('Failed to process delegator rewards', { delegator, error });
    }
}

async function checkAndCacheReward(provider: string, chain_id: string, reward: Reward): Promise<boolean> {
    const cacheKey = `dualStackingDelegatorRewards-${provider}-${chain_id}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);

    for (const amount of reward.amount) {
        const rewardAmount = BigInt(amount.amount);
        const rewardDenom = amount.denom;

        if (cachedValue && cachedValue.amount === rewardAmount.toString() && cachedValue.denom === rewardDenom) {
            // logger.info('Skipped inserting duplicate dual stacking delegator reward record (cache hit)', {
            //     provider,
            //     chain_id,
            //     amount: amount.amount,
            //     denom: amount.denom
            // });
            return false;
        }

        await MemoryCache.setDict(cacheKey, { amount: rewardAmount.toString(), denom: rewardDenom }, 3600);
    }

    return true;
}

let batchData: JsinfoSchema.InsertDualStackingDelegatorRewards[] = [];
let batchStartTime: Date = new Date();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 60000; // 1 minute in milliseconds

async function batchAppend(db: PostgresJsDatabase, newReward: JsinfoSchema.InsertDualStackingDelegatorRewards): Promise<void> {
    const cacheKey = `dualStackingDelegatorRewards-batchAppend-${newReward.provider}-${newReward.chainId}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.amount === newReward.amount.toString() && cachedValue.denom === newReward.denom) {
        // Skip appending duplicate record
        return;
    }

    batchData.push(newReward);

    if (batchData.length >= BATCH_SIZE || Date.now() - batchStartTime.getTime() >= BATCH_INTERVAL) {
        await batchInsert(db);
    }

    // Update the cache after appending
    await MemoryCache.setDict(cacheKey, { amount: newReward.amount.toString(), denom: newReward.denom }, 3600);
}

async function batchInsert(db: PostgresJsDatabase): Promise<void> {
    if (batchData.length === 0) return;

    const startTime = performance.now();
    try {
        await db.insert(JsinfoSchema.dualStackingDelegatorRewards).values(batchData);

        const endTime = performance.now();
        logger.info(`Batch insert of ${batchData.length} records took ${(endTime - startTime) / 1000} seconds`);

        // After successful insert, reset the batch
        batchData = [];
        batchStartTime = new Date();
    } catch (error) {
        logger.error('DualStakingDelegatorRewards:: Error in batch insert operation', { error });
    }
}

async function ProcessReward(db: PostgresJsDatabase, reward: Reward): Promise<void> {
    const startTime = performance.now();
    const { provider, chain_id } = reward;

    const shouldProceedToDB = await checkAndCacheReward(provider, chain_id, reward);

    if (shouldProceedToDB) {
        await insertRewardToDB(db, reward);
    }

    const endTime = performance.now();
    if ((endTime - startTime) > 1000) {
        logger.info(`ProcessReward for provider ${provider}, chain ${chain_id} took ${(endTime - startTime) / 1000} seconds`);
    }
}

async function insertRewardToDB(db: PostgresJsDatabase, reward: Reward): Promise<void> {
    const startTime = performance.now();
    const { provider, chain_id } = reward;

    for (const amount of reward.amount) {
        const newReward: JsinfoSchema.InsertDualStackingDelegatorRewards = {
            timestamp: new Date(),
            provider,
            chainId: chain_id,
            amount: BigInt(amount.amount),
            denom: amount.denom
        };

        try {
            const queryStartTime = performance.now();
            const latestEntry = await db.select()
                .from(JsinfoSchema.dualStackingDelegatorRewards)
                .where(and(
                    eq(JsinfoSchema.dualStackingDelegatorRewards.provider, provider),
                    eq(JsinfoSchema.dualStackingDelegatorRewards.chainId, chain_id)
                ))
                .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp))
                .limit(1);
            const queryEndTime = performance.now();
            if ((queryEndTime - queryStartTime) > 500) { // Log if query takes more than 500ms
                logger.info(`DB query in insertRewardToDB took ${(queryEndTime - queryStartTime)} ms`);
            }

            if (latestEntry.length === 0 ||
                latestEntry[0].amount !== newReward.amount ||
                latestEntry[0].denom !== newReward.denom) {

                batchAppend(db, newReward);
            }
        } catch (error) {
            logger.error('Failed to process reward', {
                provider,
                chain_id,
                amount: amount.amount,
                denom: amount.denom,
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
        }
    }

    const endTime = performance.now();
    if ((endTime - startTime) > 1000) {
        logger.info(`insertRewardToDB for provider ${provider}, chain ${chain_id} took ${(endTime - startTime) / 1000} seconds`);
    }
}



