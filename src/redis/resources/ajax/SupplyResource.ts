import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';

interface SupplyData {
    amount: bigint;
}

interface SupplyArgs {
    type: 'total' | 'circulating';
}

import { LockedVestingTokensService } from "@jsinfo/redis/resources/global/LockedVestingTokensResource";
import { REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS } from "@jsinfo/utils/consts";
import { logger } from '@jsinfo/utils/logger';
import { queryRpc } from '@jsinfo/indexer/utils/lavajsRpc';
import { LavaClient } from '@jsinfo/indexer/lavaTypes';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { supplyHistory } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

async function getPoolsAmount(client: LavaClient): Promise<bigint> {
    const lavaClient = client.lavanet.lava.rewards;
    let pools = await lavaClient.pools();

    let totalAmount = 0n;

    // check why iprpc pools are missin
    pools.pools.forEach((pool: any) => {
        if (REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS.includes(pool.name)) {
            if (pool.denom === 'ulava') {
                totalAmount += BigInt(pool.balance[0].amount);
            }
        }
    })

    return totalAmount;
}

async function getTotalTokenSupply(client: LavaClient): Promise<bigint> {
    const cosmosClient = client.cosmos;
    let supplies = await cosmosClient.bank.v1beta1.totalSupply();
    let totalSupply = 0n;

    supplies.supply.forEach((supply) => {
        if (supply.denom === 'ulava') {
            totalSupply += BigInt(supply.amount);
        }
    });

    return totalSupply;
}

async function getCirculatingTokenSupply(client: LavaClient, totalSupplyAmount: bigint): Promise<bigint> {
    const lockedTokens = await LockedVestingTokensService.fetch();
    if (!lockedTokens) {
        throw new Error('Error getting locked tokens');
    }
    const poolsAmount = await getPoolsAmount(client);

    try {
        // Ensure all values are BigInt before calculation
        const continuousVesting = BigInt(lockedTokens.ContinuousVesting.total);
        const periodicVesting = BigInt(lockedTokens.PeriodicVesting.total);

        const calculatedSupply = totalSupplyAmount - continuousVesting - periodicVesting - poolsAmount;

        if (calculatedSupply < 0n) {
            try {
                logger.warn('Negative circulating supply detected', {
                    totalSupply: totalSupplyAmount.toString(),
                    continuousVesting: continuousVesting.toString(),
                    periodicVesting: periodicVesting.toString(),
                    poolsAmount: poolsAmount.toString(),
                    calculatedSupply: calculatedSupply.toString()
                });
            } catch (logError) {
                logger.error('Error while logging negative supply', { error: logError });
            }
            return 0n;
        }

        return calculatedSupply;
    } catch (error) {
        logger.error('Error calculating circulating supply', {
            error,
            totalSupply: totalSupplyAmount.toString(),
            lockedTokens: JSON.stringify(lockedTokens),
            poolsAmount: poolsAmount.toString()
        });
        return 0n;
    }
}

async function saveSupplyHistory(type: 'circulating' | 'total', amount: bigint): Promise<void> {
    try {
        if (amount === 0n || !IsMeaningfulText(amount.toString())) {
            logger.debug('Skipping supply history save - amount is 0', { type });
            return;
        }

        const now = new Date();
        now.setMinutes(0, 0, 0);
        const key = `${now.toISOString().split(':')[0]}:${type}`;

        await queryJsinfo(async (db: PostgresJsDatabase) => {
            return await db.insert(supplyHistory)
                .values({
                    key,
                    type,
                    value: amount.toString(),
                })
                .onConflictDoUpdate({
                    target: [supplyHistory.key],
                    set: {
                        value: amount.toString(),
                    }
                })
                .execute();
        }, 'saveSupplyHistory_' + type);

        logger.debug('Supply history saved', { type, key, amount: amount.toString() });
    } catch (error) {
        logger.error('Error saving supply history', { error, type });
    }
}

export class SupplyResource extends RedisResourceBase<SupplyData, SupplyArgs> {
    protected readonly redisKey = 'supply-v3';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(args: SupplyArgs): Promise<SupplyData> {
        if (args.type === 'total') {
            const totalSupply = await queryRpc(
                async (_, __, lavaClient) => getTotalTokenSupply(lavaClient),
                'getTotalTokenSupply'
            );
            logger.debug(`SaveTokenSupplyToDB: Total token supply: ${totalSupply}`);

            // Save to history
            await saveSupplyHistory('total', BigInt(totalSupply));

            return { amount: BigInt(totalSupply) };
        }

        if (args.type === 'circulating') {
            const totalSupply = await SupplyService.fetch({ type: 'total' });
            if (!totalSupply || !IsMeaningfulText(totalSupply.amount + "")) {
                console.log("Total supply not fetched");
                return { amount: 0n };
            }
            const circulatingSupply = await queryRpc(
                async (_, __, lavaClient) => getCirculatingTokenSupply(lavaClient, BigInt(totalSupply.amount)),
                'getCirculatingTokenSupply'
            );

            // Save to history
            await saveSupplyHistory('circulating', BigInt(circulatingSupply));

            logger.debug(`SaveTokenSupplyToDB: Circulating supply: ${circulatingSupply}`);
            return { amount: BigInt(circulatingSupply) };
        }

        return { amount: 0n };
    }
}

export const SupplyService = new SupplyResource();