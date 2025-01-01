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

    const calculatedSupply = totalSupplyAmount - BigInt(lockedTokens.ContinuousVesting.total) - BigInt(lockedTokens.PeriodicVesting.total) - BigInt(poolsAmount);

    if (calculatedSupply < 0n) {
        logger.warn('Negative circulating supply detected', {
            totalSupply: totalSupplyAmount.toString(),
            continuousVesting: lockedTokens.ContinuousVesting.total,
            periodicVesting: lockedTokens.PeriodicVesting.total,
            poolsAmount: poolsAmount.toString(),
            calculatedSupply: calculatedSupply.toString()
        });
        return 0n;
    }

    return calculatedSupply;
}

export class SupplyResource extends RedisResourceBase<SupplyData, SupplyArgs> {
    protected readonly redisKey = 'supply-v2';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(args: SupplyArgs): Promise<SupplyData> {
        if (args.type === 'total') {
            const totalSupply = await queryRpc(
                async (_, __, lavaClient) => getTotalTokenSupply(lavaClient),
                'getTotalTokenSupply'
            );
            logger.debug(`SaveTokenSupplyToDB: Total token supply: ${totalSupply}`);
            return { amount: BigInt(totalSupply) };
        }

        if (args.type === 'circulating') {
            const totalSupply = await SupplyService.fetch({ type: 'total' });
            if (!totalSupply || !IsMeaningfulText(totalSupply.amount + "")) {
                console.log("Total supply not fetched");
                return { amount: 0n };
            }
            const circulatingSupply = await queryRpc(
                async (_, __, lavaClient) => getCirculatingTokenSupply(lavaClient, totalSupply.amount),
                'getCirculatingTokenSupply'
            );
            logger.debug(`SaveTokenSupplyToDB: Circulating supply: ${circulatingSupply}`);
            return { amount: BigInt(circulatingSupply) };
        }

        return { amount: 0n };
    }
}

export const SupplyService = new SupplyResource();