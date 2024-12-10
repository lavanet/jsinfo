import { ContinuousVestingAccount, PeriodicVestingAccount } from "cosmjs-types/cosmos/vesting/v1beta1/vesting";
import { LavaClient } from "../../../indexer/lavaTypes";
import { RedisResourceBase } from "@jsinfo/redis/classes/RedisResourceBase";
import { queryRpc } from "@jsinfo/indexer/utils/lavajsRpc";

export interface LockedTokensVestingTypeInfo {
    accounts: number;
    total: bigint;
}

export interface LockedTokensVestingStats {
    ContinuousVesting: LockedTokensVestingTypeInfo;
    PeriodicVesting: LockedTokensVestingTypeInfo;
    timestamp: number;
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

export async function ComosGetLockedVestingTokens(now: number, client: LavaClient): Promise<LockedTokensVestingStats> {
    const nowSeconds = Math.floor(now / 1000);
    const cosmosClient = client.cosmos;
    let nextKey: Uint8Array | null = null;

    const stats: LockedTokensVestingStats = {
        ContinuousVesting: { accounts: 0, total: 0n },
        PeriodicVesting: { accounts: 0, total: 0n },
        timestamp: now
    };

    do {
        const pagination = nextKey ? { pagination: { key: nextKey, offset: BigInt(0), limit: BigInt(1000), countTotal: false, reverse: false } } : {};
        const response = await cosmosClient.auth.v1beta1.accounts(pagination);

        nextKey = response.pagination?.nextKey ?? null;

        response.accounts.forEach((account) => {
            if (account.typeUrl == "/cosmos.vesting.v1beta1.ContinuousVestingAccount") {
                const vestingAccount = ContinuousVestingAccount.decode(account.value);
                stats.ContinuousVesting.accounts++;
                stats.ContinuousVesting.total += parseContinuousVestingAccount(nowSeconds, vestingAccount);
            } else if (account.typeUrl == "/cosmos.vesting.v1beta1.PeriodicVestingAccount") {
                const vestingAccount = PeriodicVestingAccount.decode(account.value);
                stats.PeriodicVesting.accounts++;
                stats.PeriodicVesting.total += parsePeriodicVestingAccount(nowSeconds, vestingAccount);
            }
        });
    } while (nextKey && nextKey?.length != 0);

    return stats;
}

export class LockedVestingTokensResource extends RedisResourceBase<LockedTokensVestingStats, {}> {
    protected redisKey = 'lockedVestingTokens';
    protected cacheExpirySeconds = 600;

    protected async fetchFromSource(): Promise<LockedTokensVestingStats> {
        const now = new Date();
        const circulatingSupply = await queryRpc(
            async (_, __, lavaClient) => ComosGetLockedVestingTokens(now.getTime(), lavaClient),
            'getLockedVestingTokens'
        );
        return circulatingSupply;
    }
}

export const LockedVestingTokensService = new LockedVestingTokensResource();