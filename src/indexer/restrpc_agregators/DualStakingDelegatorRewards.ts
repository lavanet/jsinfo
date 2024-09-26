import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "./utils";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { RedisCache } from "../../query/classes/RedisCache";
import { } from 'drizzle-orm';

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
    try {
        const providers = await db.select()
            .from(JsinfoSchema.providers)
            .where(isNotNull(JsinfoSchema.providers.address));

        const filteredProviders = providers.filter(provider =>
            provider.address && provider.address.trim() !== ""
        );

        const uniqueDelegators = new Set<string>();

        for (const provider of filteredProviders) {
            const delegators = await GetProviderDelegators(provider.address as string);

            for (const delegation of delegators.delegations) {
                if (!IsMeaningfulText(delegation.delegator)) {
                    continue;
                }
                uniqueDelegators.add(delegation.delegator);
            }
        }

        const delegatorsArray = Array.from(uniqueDelegators);
        await RedisCache.setArray('uniqueDelegators', delegatorsArray, 3600);

        for (const delegator of delegatorsArray) {
            await ProcessDelegatorRewards(db, delegator);
        }

        logger.info('Successfully processed dual stacking delegator rewards for all unique delegators.');
    } catch (error) {
        logger.error('Error processing dual stacking delegator rewards', { error });
        throw error;
    }
}

async function ProcessDelegatorRewards(db: PostgresJsDatabase, delegator: string): Promise<void> {
    try {
        const rewardsResponse = await GetDelegatorRewards(delegator);

        for (const reward of rewardsResponse.rewards) {
            await ProcessReward(db, reward);
        }
    } catch (error) {
        logger.error('Failed to process delegator rewards', { delegator, error });
    }
}

async function checkAndCacheReward(provider: string, chain_id: string, reward: Reward): Promise<boolean> {
    const cacheKey = `dualStackingDelegatorRewards-${provider}-${chain_id}`;

    const cachedValue = await RedisCache.getDict(cacheKey);

    for (const amount of reward.amount) {
        const rewardAmount = BigInt(amount.amount);
        const rewardDenom = amount.denom;

        if (cachedValue && cachedValue.amount === rewardAmount.toString() && cachedValue.denom === rewardDenom) {
            logger.info('Skipped inserting duplicate dual stacking delegator reward record (cache hit)', {
                provider,
                chain_id,
                amount: amount.amount,
                denom: amount.denom
            });
            return false;
        }

        await RedisCache.setDict(cacheKey, { amount: rewardAmount.toString(), denom: rewardDenom }, 3600);
    }

    return true;
}

async function insertRewardToDB(db: PostgresJsDatabase, reward: Reward): Promise<void> {
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
            const latestEntry = await db.select()
                .from(JsinfoSchema.dualStackingDelegatorRewards)
                .where(and(
                    eq(JsinfoSchema.dualStackingDelegatorRewards.provider, provider),
                    eq(JsinfoSchema.dualStackingDelegatorRewards.chainId, chain_id)
                ))
                .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp))
                .limit(1);

            if (latestEntry.length === 0 ||
                latestEntry[0].amount !== newReward.amount ||
                latestEntry[0].denom !== newReward.denom) {

                await db.insert(JsinfoSchema.dualStackingDelegatorRewards).values(newReward);
                logger.info('New dual stacking delegator reward record inserted', {
                    provider,
                    chain_id,
                    amount: amount.amount,
                    denom: amount.denom
                });
            } else {
                logger.info('Skipped inserting duplicate dual stacking delegator reward record (db check)', {
                    provider,
                    chain_id,
                    amount: amount.amount,
                    denom: amount.denom
                });
            }
        } catch (error) {
            logger.error('Failed to process reward', {
                provider,
                chain_id,
                amount: amount.amount,
                denom: amount.denom,
                error
            });
        }
    }
}

// Main function to process rewards by first checking cache and then updating DB if needed
async function ProcessReward(db: PostgresJsDatabase, reward: Reward): Promise<void> {
    const { provider, chain_id } = reward;

    // First, check the cache
    const shouldProceedToDB = await checkAndCacheReward(provider, chain_id, reward);

    // If cache miss or no duplicate, proceed to insert into the database
    if (shouldProceedToDB) {
        await insertRewardToDB(db, reward);
    }
}



