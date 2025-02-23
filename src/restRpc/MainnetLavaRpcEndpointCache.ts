// src/indexer/classes/RpcEndpointCahce.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaMainnetRPC } from '@jsinfo/restRpc/MainnetLavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { IsMeaningfulText, TruncateError } from '@jsinfo/utils/fmt';
import { ProcessTokenArrayAtTime } from '@jsinfo/redis/resources/APR/ProcessLavaRpcTokenArray';
import { FetchRestData } from '@jsinfo/restRpc/RestFetch';
import { EstimatedRewardsResponse } from './LavaRpcOnDemandEndpointCache';
import { ProcessedTokenArray } from '../redis/resources/APR/ProcessLavaRpcTokenArray';
import { ProcessMinimalTokenArray, ProcessedMinimalTokenArray } from '@jsinfo/redis/resources/APR/ProcessLavaRpcTokenArray';
import { EntryDoesNotExistException } from './RestFetch';

const CACHE_KEYS = {
    MAINNET_PROVIDER_REWARDS_NO_AMOUNT_NO_DENOM: (provider: string) =>
        `mainnet_provider_rewards_no_amount_no_denom:${provider}`,
    MAINNET_VALIDATORS: 'mainnet_validators_v1',
    MAINNET_VALIDATOR_REWARDS: (validator: string) =>
        `mainnet_validator_rewards:${validator}`,
    MAINNET_VALIDATOR_OUTSTANDING_REWARDS: (validator: string) =>
        `mainnet_validator_outstanding_rewards:${validator}`,
    MAINNET_VALIDATOR_DELEGATIONS: (validator: string) =>
        `mainnet_validator_delegations:${validator}`,
    MAINNET_VALIDATOR_UNBONDING: (validator: string) =>
        `mainnet_validator_unbonding:${validator}`,
    MAINNET_VALIDATOR_ESTIMATED_REWARDS: (validator: string) =>
        `mainnet_validator_estimated_rewards:${validator}`,
} as const;

// Interfaces for validator data
interface ValidatorCommissionRates {
    rate: string;
    max_rate: string;
    max_change_rate: string;
}

interface ValidatorCommission {
    commission_rates: ValidatorCommissionRates;
    update_time: string;
}

// Add interfaces for rewards
interface RewardAmount {
    denom: string;
    amount: string;
}

interface ValidatorDistributionRewardsResponse {
    operator_address: string;
    self_bond_rewards: RewardAmount[];
    commission: RewardAmount[];
}

interface ValidatorOutstandingRewardsResponse {
    rewards: {
        rewards: RewardAmount[];
    };
}

// interface ValidatorCommissionResponse {
//     commission: {
//         commission: RewardAmount[];
//     };
// }

export interface EstimatedValidatorDistributionRewardsResponse {
    info: Array<{
        source: string;
        amount: {
            denom: string;
            amount: string;
        };
    }>;
    total: Array<{
        denom: string;
        amount: string;
    }>;
}

// Update Validator interface with proper processed types
interface Validator {
    address: string;
    moniker: string;
    jailed: boolean;
    tokens: string;
    commission: ValidatorCommission;
    distribution?: {
        self_bond_rewards: ProcessedMinimalTokenArray;
        commission: ProcessedMinimalTokenArray;
        operator_address: string;
    };
    outstanding_rewards?: ProcessedMinimalTokenArray;
    estimated_rewards?: ProcessedTokenArray;
    delegations?: DelegationsResponse;
    unbonding_delegations?: UnbondingDelegationsResponse;
}

export interface ValidatorsWithRewardsResponse {
    height: number;
    datetime: number;
    validators: Validator[];
}

// Add interfaces for delegations
interface DelegationBalance {
    denom: string;
    amount: string;
}

interface DelegationInfo {
    delegator_address: string;
    validator_address: string;
    shares: string;
}

interface DelegationResponse {
    delegation: DelegationInfo;
    balance: DelegationBalance;
}

interface DelegationsResponse {
    delegation_responses: DelegationResponse[];
    pagination: {
        next_key: string | null;
        total: string;
    };
}

// Add interfaces for unbonding
interface UnbondingEntry {
    creation_height: string;
    completion_time: string;
    initial_balance: string;
    balance: string;
    unbonding_id: string;
    unbonding_on_hold_ref_count: string;
}

interface UnbondingResponse {
    delegator_address: string;
    validator_address: string;
    entries: UnbondingEntry[];
}

interface UnbondingDelegationsResponse {
    unbonding_responses: UnbondingResponse[];
    pagination: {
        next_key: string | null;
        total: string;
    };
}

// Get and process all validator data
export async function GetMainnetValidatorsWithRewards(): Promise<ValidatorsWithRewardsResponse> {
    let validatorsData = await RedisCache.getDict(CACHE_KEYS.MAINNET_VALIDATORS) as ValidatorsWithRewardsResponse;

    if (!validatorsData) {
        try {
            logger.info('Fetching validators data from API');
            validatorsData = await FetchRestData<ValidatorsWithRewardsResponse>('https://jsinfo.mainnet.lavanet.xyz/validators');
            logger.info(`Found ${validatorsData.validators.length} validators`);

            for (const validator of validatorsData.validators) {
                try {
                    await processValidatorRewards(validator);
                } catch (error) {
                    logger.error(`Error processing validator ${validator.address}:`, error);
                }
            }

            logger.info('Caching validators data');
            await RedisCache.setDict(CACHE_KEYS.MAINNET_VALIDATORS, validatorsData, 5 * 60);
        } catch (error) {
            logger.error('Error fetching validators data:', error);
            throw error;
        }
    }

    return validatorsData;
}

async function processValidatorRewards(validator: Validator) {
    logger.info(`Processing rewards for validator ${validator.address}`);

    const [rewards, outstandingRewards, estimatedRewards, delegations, unbonding] = await Promise.all([
        GetValidatorRewards(validator.address),
        GetValidatorOutstandingRewards(validator.address),
        // GetValidatorCommission(validator.address),
        GetValidatorEstimatedRewards(validator.address),
        GetValidatorDelegations(validator.address),
        GetValidatorUnbonding(validator.address)
    ]);

    // Process distribution rewards
    if (rewards) {
        validator.distribution = {
            self_bond_rewards: await ProcessMinimalTokenArray(rewards.self_bond_rewards),
            commission: await ProcessMinimalTokenArray(rewards.commission),
            operator_address: rewards.operator_address
        };
    }

    if (outstandingRewards) {
        validator.outstanding_rewards = await ProcessMinimalTokenArray(outstandingRewards.rewards.rewards);
    }

    // Process estimated rewards separately
    validator.estimated_rewards = await ProcessTokenArrayAtTime(estimatedRewards, null);

    // Store delegations and unbonding if they exist
    if (delegations) validator.delegations = delegations;
    if (unbonding) validator.unbonding_delegations = unbonding;
}

// https://lava.rest.lava.build/cosmos/distribution/v1beta1/validators/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc
// Update GetValidator functions with proper types
async function GetValidatorRewards(validatorAddress: string): Promise<ValidatorDistributionRewardsResponse | null> {
    const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_REWARDS(validatorAddress);
    let rewards = await RedisCache.getDict(cacheKey) as ValidatorDistributionRewardsResponse;

    if (!rewards) {
        try {
            rewards = await QueryLavaMainnetRPC<ValidatorDistributionRewardsResponse>(`/cosmos/distribution/v1beta1/validators/${validatorAddress}`);
            await RedisCache.setDict(cacheKey, rewards, 5 * 60);
        } catch (error) {
            if (error instanceof EntryDoesNotExistException) {
                return null;
            }
            throw error;
        }
    }

    return rewards;
}

// https://lava.rest.lava.build/cosmos/distribution/v1beta1/validators/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc/outstanding_rewards
async function GetValidatorOutstandingRewards(validatorAddress: string): Promise<ValidatorOutstandingRewardsResponse | null> {
    const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_OUTSTANDING_REWARDS(validatorAddress);
    let rewards = await RedisCache.getDict(cacheKey) as ValidatorOutstandingRewardsResponse;

    if (!rewards) {
        try {
            rewards = await QueryLavaMainnetRPC<ValidatorOutstandingRewardsResponse>(
                `/cosmos/distribution/v1beta1/validators/${validatorAddress}/outstanding_rewards`
            );
            await RedisCache.setDict(cacheKey, rewards, 5 * 60);
        } catch (error) {
            if (error instanceof EntryDoesNotExistException) {
                return null;
            }
            throw error;
        }
    }

    return rewards;
}

// // https://lava.rest.lava.build/cosmos/distribution/v1beta1/validators/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc/commission
// // Update GetValidator functions with proper types
// async function GetValidatorCommission(validatorAddress: string): Promise<ValidatorCommissionResponse | null> {
//     const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_COMMISSION(validatorAddress);
//     let commission = await RedisCache.getDict(cacheKey) as ValidatorCommissionResponse;

//     if (!commission) {
//         try {
//             commission = await QueryLavaMainnetRPC<ValidatorCommissionResponse>(
//                 `/cosmos/distribution/v1beta1/validators/${validatorAddress}/commission`
//             );
//             await RedisCache.setDict(cacheKey, commission, 5 * 60);
//         } catch (error) {
//             if (error instanceof EntryDoesNotExistException) {
//                 return null;
//             }
//             throw error;
//         }
//     }

//     return commission;
// }

// https://lava.rest.lava.build/lavanet/lava/subscription/estimated_validator_rewards/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc/
async function GetValidatorEstimatedRewards(validatorAddress: string): Promise<EstimatedValidatorDistributionRewardsResponse> {
    const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_ESTIMATED_REWARDS(validatorAddress);
    let rewards = await RedisCache.getDict(cacheKey) as EstimatedValidatorDistributionRewardsResponse;

    if (!rewards) {
        rewards = await QueryLavaMainnetRPC<EstimatedValidatorDistributionRewardsResponse>(
            `/lavanet/lava/subscription/estimated_validator_rewards/${validatorAddress}/`
        );
        await RedisCache.setDict(cacheKey, rewards, 5 * 60);
    }

    return rewards;
}

// https://lava.rest.lava.build/cosmos/staking/v1beta1/validators/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc/delegations
// Add new functions to get delegations and unbonding
async function GetValidatorDelegations(validatorAddress: string): Promise<DelegationsResponse | null> {
    const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_DELEGATIONS(validatorAddress);
    let delegations = await RedisCache.getDict(cacheKey) as DelegationsResponse;

    if (!delegations) {
        try {
            delegations = await QueryLavaMainnetRPC(`/cosmos/staking/v1beta1/validators/${validatorAddress}/delegations`);
            await RedisCache.setDict(cacheKey, delegations, 5 * 60);
        } catch (error) {
            if (error instanceof EntryDoesNotExistException) {
                return null;
            }
            throw error;
        }
    }

    return delegations;
}

// https://lava.rest.lava.build/cosmos/staking/v1beta1/validators/lava%40valoper1q9xyutm3888xarak5zy8x95qkqhzece4cwxgqc/unbonding_delegations
async function GetValidatorUnbonding(validatorAddress: string): Promise<UnbondingDelegationsResponse | null> {
    const cacheKey = CACHE_KEYS.MAINNET_VALIDATOR_UNBONDING(validatorAddress);
    let unbonding = await RedisCache.getDict(cacheKey) as UnbondingDelegationsResponse;

    if (!unbonding) {
        try {
            unbonding = await QueryLavaMainnetRPC(`/cosmos/staking/v1beta1/validators/${validatorAddress}/unbonding_delegations`);
            await RedisCache.setDict(cacheKey, unbonding, 5 * 60);
        } catch (error) {
            if (error instanceof EntryDoesNotExistException) {
                return null;
            }
            throw error;
        }
    }

    return unbonding;
}

// Keep existing functions
export async function MainnetGetEstimatedProviderRewardsNoAmountNoDenom(provider: string): Promise<EstimatedRewardsResponse> {
    if (!IsMeaningfulText(provider)) {
        throw new Error(`Invalid provider: ${provider}`);
    }

    const cacheKey = CACHE_KEYS.MAINNET_PROVIDER_REWARDS_NO_AMOUNT_NO_DENOM(provider);
    let rewards = await RedisCache.getDict(cacheKey) as EstimatedRewardsResponse;

    if (!rewards) {
        try {
            const response = await QueryLavaMainnetRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_provider_rewards/${provider}/`);
            rewards = response;
            RedisCache.setDict(cacheKey, response, 30 * 60);
        } catch (error) {
            logger.error(`Error fetching estimated provider rewards for ${provider}`, { error: TruncateError(error) });
            return { info: [], total: [], recommended_block: "0" };
        }
    }

    return rewards || { info: [], total: [], recommended_block: "0" };
}