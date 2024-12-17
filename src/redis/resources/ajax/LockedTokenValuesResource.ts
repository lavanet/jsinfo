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
export interface LockedTokenValuesItem {
    key: string;
    ulavaValue: number;
    USDValue: number;
    countForTlv: boolean;
}

export class LockedTokenValuesResource extends RedisResourceBase<LockedTokenValuesItem[], {}> {
    protected readonly redisKey = 'LockedTokenValues';
    protected readonly cacheExpirySeconds = 300;

    private async fetchLockedTokenValues(): Promise<LockedTokenValuesItem[]> {
        let currentStep = 'initialization';
        try {
            const result: LockedTokenValuesItem[] = [];

            currentStep = 'GetLavaUSDRate';
            const currentLavaUSDPrice = await CoinGekoCache.GetLavaUSDRate();

            currentStep = 'fetchIndexProviderDelegationSum';
            await this.addIndexStakesAndDelegationToResult(result, currentLavaUSDPrice);

            currentStep = 'addEmptyProviderDelegationsToResult';
            await this.addEmptyProviderDelegationsToResult(result, currentLavaUSDPrice);

            currentStep = 'addRewardsPoolsToResult';
            await this.addRewardsPoolsToResult(result, currentLavaUSDPrice);

            currentStep = 'addSubscriptionsToResult';
            await this.addSubscriptionsToResult(result, currentLavaUSDPrice);

            currentStep = 'addDexesToResult';
            await this.addDexesToResult(result, currentLavaUSDPrice);

            currentStep = 'addLockedVestingTokensToResult';
            await this.addLockedVestingTokensToResult(result, currentLavaUSDPrice);

            currentStep = 'addStakingPool';
            await this.addStakingPoolToResult(result, currentLavaUSDPrice);

            return result;
        } catch (error) {
            logger.error('LockedTokenValuesResource: Error fetching total value locked:', {
                failedStep: currentStep,
                error: error instanceof Error ? error.message : error,
                stack: error instanceof Error ? error.stack : undefined,
                details: JSON.stringify(error, Object.getOwnPropertyNames(error)),
                timestamp: new Date().toISOString()
            });
            throw new Error(`LockedTokenValuesResource: Failed to fetch total value locked during ${currentStep}`);
        }
    }


    private async addEmptyProviderDelegationsToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
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
            USDValue: this.convertUlavaToUSD(emptyProviderDelegationsSum, currentLavaUSDPrice),
            countForTlv: false
        });
    }

    private async addLockedVestingTokensToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        const lockedTokensStats = await LockedVestingTokensService.fetch();
        if (!lockedTokensStats) {
            throw new Error('Error getting locked tokens');
        }

        result.push({
            key: 'Cosmos_LavaLockedVestingTokens_Continuous',
            ulavaValue: Number(lockedTokensStats.ContinuousVesting.total),
            USDValue: this.convertUlavaToUSD(lockedTokensStats.ContinuousVesting.total, currentLavaUSDPrice),
            countForTlv: false
        });

        result.push({
            key: 'Cosmos_LavaLockedVestingTokens_Periodic',
            ulavaValue: Number(lockedTokensStats.PeriodicVesting.total),
            USDValue: this.convertUlavaToUSD(lockedTokensStats.PeriodicVesting.total, currentLavaUSDPrice),
            countForTlv: false
        });
    }

    private async addDexesToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        // Add Osmosis TVL
        const osmosisValues = await OsmosisGetTotalLavaLockedValue();
        if (osmosisValues && IsMeaningfulText(osmosisValues.ulavaValue + "")) {
            result.push({
                key: 'Dex_Osmosis',
                ulavaValue: osmosisValues.ulavaValue,
                USDValue: osmosisValues.usdValue,
                countForTlv: true
            });
        }

        // Add Base TVL
        const baseTotalLockedValueInUsd = await BaseGetTotalLockedValue();
        if (baseTotalLockedValueInUsd && IsMeaningfulText(baseTotalLockedValueInUsd + "")) {
            result.push({
                key: 'Dex_Base',
                ulavaValue: Math.round((Number(baseTotalLockedValueInUsd) / currentLavaUSDPrice) * 1000000),
                USDValue: Number(baseTotalLockedValueInUsd),
                countForTlv: true
            });
        }

        // Add Arbitrum TVL
        const arbitrumTotalLockedValueInUsd = await AribitrumGetTotalLavaValue();
        if (arbitrumTotalLockedValueInUsd && IsMeaningfulText(arbitrumTotalLockedValueInUsd + "")) {
            result.push({
                key: 'Dex_Arbitrum',
                ulavaValue: Math.round((Number(arbitrumTotalLockedValueInUsd) / currentLavaUSDPrice) * 1000000),
                USDValue: Number(arbitrumTotalLockedValueInUsd),
                countForTlv: true
            });
        }
    }

    private async addIndexStakesAndDelegationToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        const { stakesSum, delegationSum } = await this.fetchIndexStakesAndDelegationSums();
        result.push({
            key: 'Lava_TotalProviderStakes',
            ulavaValue: Number(stakesSum),
            USDValue: this.convertUlavaToUSD(stakesSum, currentLavaUSDPrice),
            countForTlv: false
        });
        result.push({
            key: 'Lava_TotalDelegationsToProvider',
            ulavaValue: Number(delegationSum),
            USDValue: this.convertUlavaToUSD(delegationSum, currentLavaUSDPrice),
            countForTlv: false
        });
    }

    private async addRewardsPoolsToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        const rewardsPools = await RpcOnDemandEndpointCache.GetRewardsPools();

        for (const pool of rewardsPools.pools) {
            const { poolUlavaValue, poolUSDValue } = await this.calculateRewardPoolValues(pool, currentLavaUSDPrice);

            result.push({
                key: `Lava_RewardsPool_${pool.name}`,
                ulavaValue: Number(poolUlavaValue),
                USDValue: poolUSDValue,
                countForTlv: REWARD_POOL_NAMES_TO_CONSIDER_IN_TOTAL_TOKEN_VALUE_CALCULATIONS.includes(pool.name)
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
            poolUSDValue += this.convertUlavaToUSD(amount, currentLavaUSDPrice);
        }

        return { poolUlavaValue, poolUSDValue };
    }

    private async addSubscriptionsToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        const subscriptionListResponse = await GetSubscriptionList();
        let subsUlavaValue = 0n;

        for (const sub of subscriptionListResponse.subs_info) {
            const amount = BigInt(sub.credit.amount);
            if (amount === 0n || sub.credit.denom !== 'ulava') continue;
            subsUlavaValue += amount;
        }

        result.push({
            key: 'Lava_Subscriptions',
            ulavaValue: Number(subsUlavaValue),
            USDValue: this.convertUlavaToUSD(subsUlavaValue, currentLavaUSDPrice),
            countForTlv: true
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

    private async addStakingPoolToResult(result: LockedTokenValuesItem[], currentLavaUSDPrice: number): Promise<void> {
        const stakingPool = await RpcOnDemandEndpointCache.GetStakingPool();

        result.push({
            key: 'Cosmos_BondedTokens',
            ulavaValue: Number(stakingPool.pool.bonded_tokens),
            USDValue: this.convertUlavaToUSD(stakingPool.pool.bonded_tokens, currentLavaUSDPrice),
            countForTlv: true,
        });
    }

    private convertUlavaToUSD(ulavaAmount: string | number | bigint, lavaUSDPrice: number): number {
        if (typeof ulavaAmount === 'bigint') {
            return Number(ulavaAmount * BigInt(Math.round(lavaUSDPrice * 1000000)) / 1000000n) / 1000000;
        }

        if (typeof ulavaAmount === 'string') {
            return this.convertUlavaToUSD(BigInt(ulavaAmount), lavaUSDPrice);
        }

        if (typeof ulavaAmount === 'number') {
            return (ulavaAmount / 1000000) * lavaUSDPrice;
        }

        logger.warn('Invalid ulava amount type', { type: typeof ulavaAmount, value: ulavaAmount });
        return 0;
    }

    protected async fetchFromSource(): Promise<LockedTokenValuesItem[]> {
        return await this.fetchLockedTokenValues();
    }
}
