import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { ProviderStakesAndDelegationResource } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';
import { Pool, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { GetSubscriptionList } from '@jsinfo/indexer/restrpc_agregators/SubscriptionListProcessor';
import { OsmosisGetTotalLavaLockedValue } from '@jsinfo/restRpc/ext/osmosisapi';
import { BaseGetTotalLockedValue } from '@jsinfo/restRpc/ext/base';
import { AribitrumGetTotalLavaValue } from '@jsinfo/restRpc/ext/arbitrum';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { logger } from '@jsinfo/utils/logger';
import { LockedVestingTokensService } from '../global/LockedVestingTokensResource';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/lavaRpcPeriodicEndpointCache';
import { REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS } from '@jsinfo/utils/consts';

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

            // currentStep = 'fetchIndexProviderDelegationSum';
            // await this.addIndexStakesAndDelegationToResult(result, currentLavaUSDPrice);

            // currentStep = 'addEmptyProviderDelegationsToResult';
            // await this.addEmptyProviderDelegationsToResult(result, currentLavaUSDPrice);

            currentStep = 'addRewardsPoolsToResult';
            await this.addRewardsPoolsToResult(result, currentLavaUSDPrice);

            currentStep = 'addSubscriptionsToResult';
            await this.addSubscriptionsToResult(result, currentLavaUSDPrice);

            currentStep = 'addDexesToResult';
            await this.addDexesToResult(result, currentLavaUSDPrice);

            // currentStep = 'addLockedVestingTokensToResult';
            // await this.addLockedVestingTokensToResult(result, currentLavaUSDPrice);

            currentStep = 'addStakingPool';
            await this.addStakingPoolToResult(result, currentLavaUSDPrice);

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


    private async addEmptyProviderDelegationsToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const delegations = await RpcPeriodicEndpointCache.GetEmptyProviderDelegations();
        const emptyProviderDelegationsSum = delegations.reduce((sum, delegation) => {
            if (delegation.amount.denom === 'ulava') {
                return sum + BigInt(delegation.amount.amount);
            }
            return sum;
        }, 0n);
        result.push({
            key: 'Lava_EmptyProviderDelegatorsThatDidNotUseLavaApi',
            ulavaValue: Number(emptyProviderDelegationsSum),
            USDValue: Number(emptyProviderDelegationsSum / 1000000n) * currentLavaUSDPrice
        });
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

    private async addIndexStakesAndDelegationToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const { stakesSum, delegationSum } = await this.fetchIndexStakesAndDelegationSums();
        result.push({
            key: 'Lava_TotalProviderStakes',
            ulavaValue: Number(stakesSum),
            USDValue: Number(BigInt(stakesSum) / 1000000n) * currentLavaUSDPrice
        });
        result.push({
            key: 'Lava_TotalDelegationsToProvider',
            ulavaValue: Number(delegationSum),
            USDValue: Number(BigInt(delegationSum) / 1000000n) * currentLavaUSDPrice
        });
    }

    private async addRewardsPoolsToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const rewardsPools = await RpcOnDemandEndpointCache.GetRewardsPools();

        for (const pool of rewardsPools.pools) {
            if (!REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS.includes(pool.name)) continue;

            const { poolUlavaValue, poolUSDValue } = await this.calculateRewardPoolValues(pool, currentLavaUSDPrice);

            result.push({
                key: `Lava_RewardsPool_${pool.name}`,
                ulavaValue: Number(poolUlavaValue),
                USDValue: poolUSDValue + (Number(BigInt(poolUlavaValue) / 1000000n) * currentLavaUSDPrice)
            });
        }
    }

    private async calculateRewardPoolValues(pool: Pool, currentLavaUSDPrice: number): Promise<{ poolUlavaValue: bigint, poolUSDValue: number }> {
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
            key: 'Lava_Subscriptions',
            ulavaValue: Number(subsUlavaValue),
            USDValue: subsUSDValue + (Number(BigInt(subsUlavaValue) / 1000000n) * currentLavaUSDPrice)
        });
    }

    private async fetchIndexStakesAndDelegationSums(): Promise<{ stakesSum: bigint, delegationSum: bigint }> {
        const indexStakes = await new ProviderStakesAndDelegationResource().fetch();
        if (!indexStakes) {
            throw new Error('Failed to fetch index stakes');
        }
        if (!indexStakes.stakeSum || !indexStakes.delegationSum) {
            throw new Error('Index stakes or delegation sum is not available');
        }
        return {
            stakesSum: BigInt(indexStakes.stakeSum),
            delegationSum: BigInt(indexStakes.delegationSum)
        };
    }

    private async addStakingPoolToResult(result: TotalValueLockedItem[], currentLavaUSDPrice: number): Promise<void> {
        const stakingPool = await RpcOnDemandEndpointCache.GetStakingPool();

        result.push({
            key: 'Cosmos_BondedTokens',
            ulavaValue: Number(stakingPool.pool.bonded_tokens),
            USDValue: Number(BigInt(stakingPool.pool.bonded_tokens) / 1000000n) * currentLavaUSDPrice
        });
    }

    protected async fetchFromSource(): Promise<TotalValueLockedItem[]> {
        return await this.fetchTotalValueLocked();
    }
}
