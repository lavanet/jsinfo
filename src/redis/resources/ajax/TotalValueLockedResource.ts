import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IndexStakesResource } from '../index/IndexStakesResource';
import { RewardsPoolsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/RpcOnDemandEndpointCache';
import { ConvertToBaseDenom } from '@jsinfo/indexer/restrpc_agregators/CurrencyConverstionUtils';
import { GetSubscriptionList } from '@jsinfo/indexer/restrpc_agregators/SubscriptionListProcessor';

// Function to sum the amounts grouped by denomination and convert to base denom
async function sumPoolsGroupedByDenom(rewardsPools: RewardsPoolsResponse): Promise<Record<string, bigint>> {
    const totals: Record<string, number> = {};

    // Iterate through each pool
    for (const pool of rewardsPools.pools) {
        // Iterate through each balance in the pool
        for (const balance of pool.balance) {
            const denom = balance.denom;
            const amount = BigInt(balance.amount);

            // Convert the amount to base denomination
            const [convertedAmount, convertedDenom] = await ConvertToBaseDenom(amount.toString(), denom);

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

export class TotalValueLockedResource extends RedisResourceBase<bigint, {}> {
    protected readonly redisKey = 'totalValueLocked';
    protected readonly ttlSeconds = 300; // Cache for 5 minutes

    // Method to fetch and calculate total value locked
    private async fetchTotalValueLocked(): Promise<bigint> {
        try {
            const indexStakes = await new IndexStakesResource().fetch();
            if (!indexStakes) {
                throw new Error('Failed to fetch index stakes');
            }

            if (!indexStakes.stakeSum) {
                throw new Error('Index stakes sum is not available');
            }

            const indexStakesSum = BigInt(indexStakes.stakeSum);

            const rewardsPools = await RpcOnDemandEndpointCache.GetRewardsPools();
            const totalsByDenom = await sumPoolsGroupedByDenom(rewardsPools);
            console.log('Total amounts grouped by denomination:', totalsByDenom);

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

            let ulavaAmount = totalsByDenom['ulava'] || 0n;
            let lavaAmount = totalsByDenom['lava'] || 0n;
            ulavaAmount += ulavaAmount + indexStakesSum
            lavaAmount += BigInt(ulavaAmount / 1000000n);

            console.log('Total amounts grouped by denomination:', totalsByDenom);
            console.log('Total in lava:', ulavaAmount);

            const totalValueLocked = ulavaAmount;

            return totalValueLocked;
        } catch (error) {
            console.error('Error fetching total value locked:', error);
            throw new Error('Failed to fetch total value locked');
        }
    }

    // Override the fetchFromDb method to get the TVL from the source
    protected async fetchFromDb(): Promise<bigint> {
        console.log('TotalValueLockedResource fetchFromDb'); // also print the ret
        const ret = await this.fetchTotalValueLocked();
        console.log('TotalValueLockedResource fetchFromDb ret:', ret);
        return ret;
    }
}
