import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IndexStakesResource } from '../index/IndexStakesResource';
import { RewardsPoolsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { ConvertToBaseDenom } from '@jsinfo/indexer/restrpc_agregators/CurrencyConverstionUtils';
import { GetSubscriptionList } from '@jsinfo/indexer/restrpc_agregators/SubscriptionListProcessor';
import { OsmosisGetTotalLavaLockedValue } from '@jsinfo/restRpc/ext/osmosisapi';
import { BaseGetTotalLockedValue } from '@jsinfo/restRpc/ext/base';
import { AribitrumGetTotalLavaValue } from '@jsinfo/restRpc/ext/arbitrum';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { logger } from '@jsinfo/utils/logger';

// Function to sum the amounts grouped by denomination and convert to base denom
async function sumPoolsGroupedByDenom(rewardsPools: RewardsPoolsResponse): Promise<Record<string, bigint>> {
    const totals: Record<string, number> = {};

    // Iterate through each pool
    for (const pool of rewardsPools.pools) {
        // Iterate through each balance in the pool
        for (const balance of pool.balance) {
            const denom = balance.denom;
            const amount = BigInt(balance.amount);
            if (amount === 0n) continue;

            // Convert the amount to base denomination
            const [convertedAmount, convertedDenom] = await ConvertToBaseDenom(amount.toString(), denom);
            if (convertedAmount === "0") continue;

            // Initialize the denomination in the totals object if it doesn't exist
            if (!totals[convertedDenom]) {
                totals[convertedDenom] = 0.0;
            }
            // Sum the amounts for the denomination
            totals[convertedDenom] += parseFloat(convertedAmount);
        }
    }

    return Object.fromEntries(
        Object.entries(totals).map(([denom, amount]) => [denom, getRoundedBigInt(amount)])
    );
}

function getRoundedBigInt(value: number): bigint {
    return BigInt(Math.ceil(value));
}

export class TotalValueLockedResource extends RedisResourceBase<number, {}> {
    protected readonly redisKey = 'totalValueLocked';
    protected readonly ttlSeconds = 300; // Cache for 5 minutes

    // Method to fetch and calculate total value locked
    private async fetchTotalValueLocked(): Promise<number> {
        try {
            const indexStakesSum = await this.fetchIndexStakesSum() / 1000000n;
            const totalsByDenom = await this.fetchRewardsPoolsTotals();

            await this.processSubscriptionList(totalsByDenom);

            let ulavaAmount = totalsByDenom['ulava'] || 0n;
            let lavaAmount = totalsByDenom['lava'] || 0n;
            ulavaAmount += ulavaAmount + indexStakesSum;
            lavaAmount += BigInt(ulavaAmount / 1000000n);

            const currentPrice = await CoinGekoCache.GetDenomToUSDRate('lava');
            if (currentPrice === 0 || isNaN(currentPrice)) {
                throw new Error('TotalValueLockedResource: CoinGekoCache.GetDenomToUSDRate returned 0 for lava');
            }

            if (currentPrice > 100000 || currentPrice < 1.e-7) {
                throw new Error(`TotalValueLockedResource: CoinGekoCache.GetDenomToUSDRate returned out of range value for lava: ${currentPrice}`);
            }

            let usdAmount = Number(lavaAmount) * Number(currentPrice);

            logger.info('[TVL] Total amounts grouped by denomination:', totalsByDenom);
            logger.info('[TVL] Total in lava:', ulavaAmount, 'usdAmount:', usdAmount);

            const osmosisTotalLockedValue = await OsmosisGetTotalLavaLockedValue();
            if (osmosisTotalLockedValue) {
                usdAmount += Number(osmosisTotalLockedValue);
            }
            const baseTotalLockedValue = await BaseGetTotalLockedValue();
            if (baseTotalLockedValue) {
                usdAmount += Number(baseTotalLockedValue);
            }

            const arbitrumTotalLockedValue = await AribitrumGetTotalLavaValue();
            if (arbitrumTotalLockedValue) {
                usdAmount += Number(arbitrumTotalLockedValue);
            }

            return usdAmount;
        } catch (error) {
            logger.error('TotalValueLockedResource: Error fetching total value locked:', {
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                timestamp: new Date().toISOString()
            });
            throw new Error('TotalValueLockedResource: Failed to fetch total value locked');
        }
    }

    private async fetchIndexStakesSum(): Promise<bigint> {
        const indexStakes = await new IndexStakesResource().fetch();
        if (!indexStakes) {
            throw new Error('Failed to fetch index stakes');
        }
        if (!indexStakes.stakeSum) {
            throw new Error('Index stakes sum is not available');
        }
        return BigInt(indexStakes.stakeSum);
    }

    private async fetchRewardsPoolsTotals(): Promise<Record<string, bigint>> {
        const rewardsPools = await RpcOnDemandEndpointCache.GetRewardsPools();
        return await sumPoolsGroupedByDenom(rewardsPools);
    }

    private async processSubscriptionList(totalsByDenom: Record<string, bigint>): Promise<void> {
        const subscriptionListResponse = await GetSubscriptionList();
        const subscriptionList = subscriptionListResponse.subs_info;
        subscriptionList.forEach((item: { credit: { denom: string; amount: string } }) => {
            const denom = item.credit.denom;
            const amount = BigInt(item.credit.amount);

            if (!totalsByDenom[denom]) {
                totalsByDenom[denom] = 0n;
            }

            totalsByDenom[denom] += BigInt(amount);
        });
    }

    protected async fetchFromDb(): Promise<number> {
        return await this.fetchTotalValueLocked();
    }
}
