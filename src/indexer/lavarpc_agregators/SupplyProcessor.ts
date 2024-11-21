// src/indexer/supply/syncSupply.ts

import { LavaClient } from "../lavaTypes";
import { ContinuousVestingAccount, PeriodicVestingAccount } from "cosmjs-types/cosmos/vesting/v1beta1/vesting";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from '@jsinfo/utils/logger';
import { queryJsinfo } from "@jsinfo/utils/db";
import { queryRpc } from "../utils/lavajsRpc";

async function getPoolsAmount(client: LavaClient): Promise<bigint> {
    const lavaClient = client.lavanet.lava.rewards;
    let pools = await lavaClient.pools();

    let totalAmount = 0n;

    pools.pools.forEach((pool: any) => {
        if (["validators_rewards_distribution_pool", "validators_rewards_allocation_pool", "providers_rewards_distribution_pool", "providers_rewards_allocation_pool"].includes(pool.name)) {
            totalAmount += BigInt(pool.balance[0].amount);
        }
    });

    return totalAmount;
}

function parsePeriodicVestingAccount(nowSeconds: number, account: any): bigint {
    let totalAmount = 0n;
    const startTime = parseInt(account.startTime);

    account.vestingPeriods.forEach((vestingPeriod: any) => {
        const current = startTime + parseInt(vestingPeriod.length);
        if (current >= nowSeconds) {
            totalAmount += BigInt(vestingPeriod.amount[0].amount);
        }
    });

    return totalAmount;
}

function parseContinuousVestingAccount(nowSeconds: number, account: any): bigint {
    const totalAmount = BigInt(account.baseVestingAccount.originalVesting[0].amount);
    const startTime = BigInt(parseInt(account.startTime));
    const endTime = BigInt(parseInt(account.baseVestingAccount.endTime));
    const nowBigInt = BigInt(nowSeconds);

    if (nowBigInt < startTime) {
        return totalAmount;
    }

    return (((endTime - nowBigInt) * totalAmount) / (endTime - startTime));
}

async function getLockedTokens(now: number, client: LavaClient): Promise<bigint> {
    const nowSeconds = Math.floor(now / 1000);

    const cosmosClient = client.cosmos;
    let lockedTokens = 0n;
    let nextKey: Uint8Array | null = null;

    do {
        const pagination = nextKey ? { pagination: { key: nextKey, offset: BigInt(0), limit: BigInt(1000), countTotal: false, reverse: false } } : {};
        const response = await cosmosClient.auth.v1beta1.accounts(pagination);

        nextKey = response.pagination?.nextKey ?? null;

        response.accounts.forEach((account) => {
            if (account.typeUrl == "/cosmos.vesting.v1beta1.ContinuousVestingAccount") {
                const vestingAccount = ContinuousVestingAccount.decode(account.value);
                lockedTokens += parseContinuousVestingAccount(nowSeconds, vestingAccount);
            } else if (account.typeUrl == "/cosmos.vesting.v1beta1.PeriodicVestingAccount") {
                const vestingAccount = PeriodicVestingAccount.decode(account.value);
                lockedTokens += parsePeriodicVestingAccount(nowSeconds, vestingAccount);
            }
        });
    } while (nextKey && nextKey?.length != 0);

    return lockedTokens;
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

async function getCirculatingTokenSupply(now: number, client: LavaClient, totalSupplyAmount: bigint): Promise<bigint> {
    const lockedTokens = await getLockedTokens(now, client);
    const poolsAmount = await getPoolsAmount(client);
    return totalSupplyAmount - lockedTokens - poolsAmount;
}

export async function SaveTokenSupplyToDB() {
    const now = new Date();
    logger.debug(`SaveTokenSupplyToDB: Current timestamp: ${now}`);

    const totalSupply = await queryRpc(
        async (_, __, lavajsClient) => getTotalTokenSupply(lavajsClient),
        'getTotalTokenSupply'
    );
    logger.debug(`SaveTokenSupplyToDB: Total token supply: ${totalSupply}`);

    const circulatingSupply = await queryRpc(
        async (_, __, lavajsClient) => getCirculatingTokenSupply(now.getTime(), lavajsClient, totalSupply),
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
