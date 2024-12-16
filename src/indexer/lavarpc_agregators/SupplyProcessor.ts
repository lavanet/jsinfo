// src/indexer/supply/syncSupply.ts

import { LavaClient } from "../lavaTypes";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { logger } from '@jsinfo/utils/logger';
import { queryJsinfo } from "@jsinfo/utils/db";
import { queryRpc } from "../utils/lavajsRpc";
import { LockedVestingTokensService } from "@jsinfo/redis/resources/global/LockedVestingTokensResource";
import { REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS } from "@jsinfo/utils/consts";

async function getPoolsAmount(client: LavaClient): Promise<bigint> {
    const lavaClient = client.lavanet.lava.rewards;
    let pools = await lavaClient.pools();

    let totalAmount = 0n;

    // check why iprpc pools are missin
    pools.pools.forEach((pool: any) => {
        if (REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS.includes(pool.name)) {
            totalAmount += BigInt(pool.balance[0].amount);
        }
    })

    return totalAmount;
}

async function getTotalTokenSupply(client: LavaClient): Promise<bigint> {
    const cosmosClient = client.cosmos;
    let supplies = await cosmosClient.bank.v1beta1.totalSupply();
    let totalSupply = 0n;

    supplies.supply.forEach((supply) => {
        totalSupply += BigInt(supply.amount);
    });

    return totalSupply;
}

async function getCirculatingTokenSupply(client: LavaClient, totalSupplyAmount: bigint): Promise<bigint> {
    const lockedTokens = await LockedVestingTokensService.fetch();
    if (!lockedTokens) {
        throw new Error('Error getting locked tokens');
    }
    const poolsAmount = await getPoolsAmount(client);
    return totalSupplyAmount - BigInt(lockedTokens.ContinuousVesting.total) - BigInt(lockedTokens.PeriodicVesting.total) - BigInt(poolsAmount);
}

export async function SaveTokenSupplyToDB() {
    const now = new Date();

    const totalSupply = await queryRpc(
        async (_, __, lavaClient) => getTotalTokenSupply(lavaClient),
        'getTotalTokenSupply'
    );
    logger.debug(`SaveTokenSupplyToDB: Total token supply: ${totalSupply}`);

    const circulatingSupply = await queryRpc(
        async (_, __, lavaClient) => getCirculatingTokenSupply(lavaClient, totalSupply),
        'getCirculatingTokenSupply'
    );
    logger.debug(`SaveTokenSupplyToDB: Circulating supply: ${circulatingSupply}`);

    const rowTotalSupply: JsinfoSchema.InsertSupply = {
        key: 'total',
        amount: totalSupply.toString(),
        timestamp: now,
    };

    const rowCirculating: JsinfoSchema.InsertSupply = {
        key: 'circulating',
        amount: circulatingSupply.toString(),
        timestamp: now,
    };

    await queryJsinfo(async (db) => {
        await db.transaction(async (tx) => {
            for (const row of [rowTotalSupply, rowCirculating]) {
                await tx.insert(JsinfoSchema.supply)
                    .values(row as any)
                    .onConflictDoUpdate({
                        target: [JsinfoSchema.supply.key],
                        set: {
                            amount: row.amount.toString(),
                            timestamp: row.timestamp,
                        } as any
                    });
            }
        });
        return { success: true };
    }, 'save_token_supply_to_db');
}
