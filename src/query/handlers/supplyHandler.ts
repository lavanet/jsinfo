// src/query/handlers/TotalSupplyRawHandler.ts
// src/query/handlers/CirculatingSupplyRawHandler.ts
import * as lavajs from '@lavanet/lavajs';
import { JSINFO_QUERY_LAVA_RPC, JSINFO_QUERY_LAVA_CHAIN_ID } from '../queryConsts';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { establishRpcConnection } from '../../utils';
import { ContinuousVestingAccount, PeriodicVestingAccount } from "cosmjs-types/cosmos/vesting/v1beta1/vesting";
import { log } from 'console';

export type LavaClient = Awaited<ReturnType<typeof lavajs.lavanet.ClientFactory.createRPCQueryClient>>;


const now = Math.floor(Date.now() / 1000);


async function getPoolsAmount(client: LavaClient): Promise<number> {
    const lavaClient = client.lavanet.lava.rewards;
    let pools = await lavaClient.pools();

    let totalAmount = 0;

    pools.pools.forEach((pool: any) => {
        if (["validators_rewards_distribution_pool", "validators_rewards_allocation_pool", "providers_rewards_distribution_pool", "providers_rewards_allocation_pool"].includes(pool.name)) {
            totalAmount += parseInt(pool.balance[0].amount);
        }
    });

    return totalAmount;
}

function parsePeriodicVestingAccount(account: any): number {
    let totalAmount = 0;
    const startTime = parseInt(account.startTime);

    account.vestingPeriods.forEach((vestingPeriod: any) => {
        const current = startTime + parseInt(vestingPeriod.length);
        if (current < now) {
            return;
        }
        totalAmount += parseInt(vestingPeriod.amount[0].amount);
    });

    return totalAmount;
}

function parseContinuousVestingAccount(account: any): number {
    const totalAmount = parseInt(account.baseVestingAccount.originalVesting[0].amount);
    const startTime = parseInt(account.startTime);
    const endTime = parseInt(account.baseVestingAccount.endTime);
    return Math.floor((((endTime - now) / (endTime - startTime)) * totalAmount) / 1000000);
}

async function getLockedTokens(client: LavaClient): Promise<number> {
    const cosmosClient = client.cosmos;
    let lockedTokens = 0;
    let nextKey: Uint8Array | null = null;

    do {
        const pagination = nextKey ? {pagination: { key: nextKey, offset: BigInt(0), limit: BigInt(1000), countTotal: false, reverse: false }} : {};
        const response = await cosmosClient.auth.v1beta1.accounts(pagination);

        nextKey = response.pagination?.nextKey ?? null;

        response.accounts.forEach((account) => {
            let decodeMethod;
            let parseMethod;

            if (account.typeUrl == "/cosmos.vesting.v1beta1.ContinuousVestingAccount") {
                decodeMethod = ContinuousVestingAccount.decode;
                parseMethod = parseContinuousVestingAccount;
            }

            else if (account.typeUrl == "/cosmos.vesting.v1beta1.PeriodicVestingAccount") {
                decodeMethod = PeriodicVestingAccount.decode;
                parseMethod = parsePeriodicVestingAccount;
            }

            if (decodeMethod && parseMethod) {
                const vestingAccount = decodeMethod(account.value);
                lockedTokens += parseMethod(vestingAccount);
            }
        });
    } while (nextKey && nextKey?.length != 0);

    return lockedTokens;
}


async function getTotalTokenSupply(client: LavaClient): Promise<{ amount: number, denom: string }> {
    const cosmosClient = client.cosmos;
    let supplies = await cosmosClient.bank.v1beta1.totalSupply();
    let totalSupply = 0;

    supplies.supply.forEach((supply) => {
        totalSupply += parseInt(supply.amount);
    });

    return { amount: totalSupply, denom: "ulava" };
}

async function getCirculatingTokenSupply(client: LavaClient, totalSupplyAmount: number): Promise<{ amount: number, denom: string }> {
    const lockedTokens = await getLockedTokens(client);
    const poolsAmount = await getPoolsAmount(client);
    const circulatingSupply = totalSupplyAmount - lockedTokens - poolsAmount;
    return { amount: circulatingSupply, denom: "ulava" };
}


export const SupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    chain_id: {
                        type: 'string'
                    },
                    total_supply: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number' },
                            denom: { type: 'string' },
                        }
                    },
                    circulating_supply: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number' },
                            denom: { type: 'string' },
                        }
                    }
                }
            }
        }
    }
}

export async function SupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const rpcConnection = await establishRpcConnection(JSINFO_QUERY_LAVA_RPC);
    const totalSupply = await getTotalTokenSupply(rpcConnection.lavajsClient);
    const circulatingSupply = await getCirculatingTokenSupply(rpcConnection.lavajsClient, totalSupply.amount);

    return {
        total_supply: totalSupply,
        circulating_supply: circulatingSupply,
        chain_id: JSINFO_QUERY_LAVA_CHAIN_ID,
    }
}