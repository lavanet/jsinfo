import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IndexStakesResource } from '../index/IndexStakesResource';
import { Pool, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { GetSubscriptionList } from '@jsinfo/indexer/restrpc_agregators/SubscriptionListProcessor';
import { OsmosisGetTotalLavaLockedValue } from '@jsinfo/restRpc/ext/osmosisapi';
import { BaseGetTotalLockedValue } from '@jsinfo/restRpc/ext/base';
import { AribitrumGetTotalLavaValue } from '@jsinfo/restRpc/ext/arbitrum';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { logger } from '@jsinfo/utils/logger';
import { LockedVestingTokensService } from '../global/LockedVestingTokensResource';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

// Renamed interface
interface TotalValueLockedItem {
    key: string;
    ulavaValue: number;
    USDValue: number;
}

export class TotalValueLockedResource extends RedisResourceBase<TotalValueLockedItem[], {}> {
    protected readonly redisKey = 'totalValueLocked';
    protected readonly cacheExpirySeconds = 300;

    private async fetchTotalValueLocked(): Promise<TotalValueLockedItem[]> {
        let currentStep = 'initialization';
        try {
            const result: TotalValueLockedItem[] = [];

            currentStep = 'GetLavaUSDRate';
            const currentLavaUSDPrice = await CoinGekoCache.GetLavaUSDRate();

            currentStep = 'addIndexStakesToResult';
            await this.addIndexStakesToResult(result, currentLavaUSDPrice);

            currentStep = 'addRewardsPoolsToResult';
            await this.addRewardsPoolsToResult(result, currentLavaUSDPrice);

            currentStep = 'addSubscriptionsToResult';
            await this.addSubscriptionsToResult(result, currentLavaUSDPrice);

            currentStep = 'addDexesToResult';
            await this.addDexesToResult(result, currentLavaUSDPrice);

            currentStep = 'addLockedVestingTokensToResult';
            await this.addLockedVestingTokensToResult(result, currentLavaUSDPrice);

            return result;
        } catch (error) {
            logger.error('TotalValueLockedResource: Error fetching total value locked:', {
                failedStep: currentStep,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                timestamp: new Date().toISOString()
            });
            throw new Error(`TotalValueLockedResource: Failed to fetch total value locked during ${currentStep}`);
        }
    }

    private async addLockedVestingTokensToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const lockedTokensStats = await LockedVestingTokensService.fetch();
        if (!lockedTokensStats) {
            throw new Error('Error getting locked tokens');
        }

        const continuousVesting = lockedTokensStats.ContinuousVesting;
        result.push({
            key: 'Cosmos_LavaLockedVestingTokens_Continuous',
            ulavaValue: Number(continuousVesting.total),
            USDValue: Number(BigInt(continuousVesting.total) / 1000000n) * currentLavaUSDPrice
        });

        const periodicVesting = lockedTokensStats.PeriodicVesting;
        result.push({
            key: 'Cosmos_LavaLockedVestingTokens_Periodic',
            ulavaValue: Number(periodicVesting.total),
            USDValue: Number(BigInt(periodicVesting.total) / 1000000n) * currentLavaUSDPrice
        });
    }

    private async addDexesToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        // Add Osmosis TVL
        const osmosisValues = await OsmosisGetTotalLavaLockedValue();
        if (osmosisValues && IsMeaningfulText(osmosisValues.ulavaValue + "")) {
            result.push({
                key: 'Dex_Osmosis',
                ulavaValue: osmosisValues.ulavaValue,
                USDValue: osmosisValues.usdValue
            });
        }

        // Add Base TVL
        const baseTotalLockedValueInUsd = await BaseGetTotalLockedValue();
        if (baseTotalLockedValueInUsd && IsMeaningfulText(baseTotalLockedValueInUsd + "")) {
            result.push({
                key: 'Dex_Base',
                ulavaValue: Math.round((Number(baseTotalLockedValueInUsd) / currentLavaUSDPrice) * 1000000),
                USDValue: Number(baseTotalLockedValueInUsd)
            });
        }

        // Add Arbitrum TVL
        const arbitrumTotalLockedValueInUsd = await AribitrumGetTotalLavaValue();
        if (arbitrumTotalLockedValueInUsd && IsMeaningfulText(arbitrumTotalLockedValueInUsd + "")) {
            result.push({
                key: 'Dex_Arbitrum',
                ulavaValue: Math.round((Number(arbitrumTotalLockedValueInUsd) / currentLavaUSDPrice) * 1000000),
                USDValue: Number(arbitrumTotalLockedValueInUsd)
            });
        }
    }

    private async addIndexStakesToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const indexStakesSum = await this.fetchIndexStakesSum();
        result.push({
            key: 'LavaTotalProviderStakes',
            ulavaValue: Number(indexStakesSum),
            USDValue: Number(BigInt(indexStakesSum) / 1000000n) * currentLavaUSDPrice
        });
    }

    private async addRewardsPoolsToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const rewardsPools = await RpcOnDemandEndpointCache.GetRewardsPools();

        for (const pool of rewardsPools.pools) {
            const { poolUlavaValue, poolUSDValue } = await this.calculatePoolValues(pool, currentLavaUSDPrice);

            result.push({
                key: `LavaRewardsPool_${pool.name}`,
                ulavaValue: Number(poolUlavaValue),
                USDValue: poolUSDValue + (Number(BigInt(poolUlavaValue) / 1000000n) * currentLavaUSDPrice)
            });
        }
    }

    private async calculatePoolValues(pool: Pool, currentLavaUSDPrice: number): Promise<{ poolUlavaValue: bigint, poolUSDValue: number }> {
        let poolUlavaValue = 0n;
        let poolUSDValue = 0;

        for (const balance of pool.balance) {
            const amount = BigInt(balance.amount);
            if (amount === 0n) continue;

            if (balance.denom !== 'ulava') {
                continue;
            }

            poolUlavaValue += amount;
            poolUSDValue += Number(BigInt(amount) / 1000000n) * currentLavaUSDPrice;
        }

        return { poolUlavaValue, poolUSDValue };
    }

    private async addSubscriptionsToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const subscriptionListResponse = await GetSubscriptionList();
        let subsUlavaValue = 0n;
        let subsUSDValue = 0;

        for (const sub of subscriptionListResponse.subs_info) {
            const amount = BigInt(sub.credit.amount);
            if (amount === 0n) continue;

            if (sub.credit.denom !== 'ulava') {
                continue;
            }
            subsUlavaValue += amount;
            subsUSDValue += Number(BigInt(amount) / 1000000n) * currentLavaUSDPrice;
        }

        result.push({
            key: 'LavaSubscriptions',
            ulavaValue: Number(subsUlavaValue),
            USDValue: subsUSDValue + (Number(BigInt(subsUlavaValue) / 1000000n) * currentLavaUSDPrice)
        });
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

    protected async fetchFromSource(): Promise<TotalValueLockedItem[]> {
        return await this.fetchTotalValueLocked();
    }
}
