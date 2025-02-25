import { logger } from '@jsinfo/utils/logger';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import { RpcOnDemandEndpointCache } from '@jsinfo/restRpc/LavaRpcOnDemandEndpointCache';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';
import { ProcessTokenArrayAtTime } from './ProcessLavaRpcTokenArray';
import { CalculateApr, LAVA_RPC_BENCHMARK_AMOUNT, LAVA_RPC_BENCHMARK_DENOM } from './AprCalcualtor';
import { AprWeighted } from './AprWeighted';
import Decimal from 'decimal.js';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

export interface RewardAmount {
    source_denom: string;
    resolved_amount: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    value_usd: string;
}

export interface ProviderAprDetails {
    apr: string;
    apr_full_num: string;
    rewards_10k_lava_delegation: RewardAmount[];
}

export interface ValidatorAprDetails {
    apr: string;
    apr_full_num: string;
}

export function formatToPercent(value: number): string {
    if (!IsMeaningfulText("" + value)) return '-';
    return (value * 100).toFixed(4) + '%';
}

export async function CalculateValidatorAprs(): Promise<Record<string, ValidatorAprDetails>> {
    const validators = await RpcPeriodicEndpointCache.GetAllValidatorsAddresses();
    if (!validators) {
        logger.error('No validators found');
        return {};
    }

    const validatorAprs: Record<string, ValidatorAprDetails> = {};

    for (const validator of validators) {
        try {
            const estimatedRewards = await RpcOnDemandEndpointCache.GetEstimatedValidatorRewards(
                validator,
                LAVA_RPC_BENCHMARK_AMOUNT,
                LAVA_RPC_BENCHMARK_DENOM
            );

            const processed = await ProcessTokenArrayAtTime({
                info: estimatedRewards.info || [],
                total: estimatedRewards.total || [],
                recommended_block: estimatedRewards.recommended_block
            });

            const totalUsdValue = processed.total?.tokens.reduce((sum, token) => {
                const usdValue = new Decimal(token.value_usd.replace('$', '') || '0');
                return sum.plus(usdValue);
            }, new Decimal(0)) || new Decimal(0);

            const currentApr = await CalculateApr(totalUsdValue.toNumber(), `Validator APR for ${validator}`);

            // Store current APR in history
            await AprWeighted.StoreApr({
                apr: currentApr,
                source: 'validator',
                address: validator
            });

            // Get weighted APR
            const weightedApr = await AprWeighted.GetWeightedApr({
                source: 'validator',
                address: validator
            });

            // Use weighted APR if available, otherwise use current APR
            const finalApr = weightedApr ?? currentApr;

            validatorAprs[validator] = {
                apr: formatToPercent(finalApr),
                apr_full_num: finalApr.toString()
            };

        } catch (error) {
            logger.error(`Failed to calculate APR for validator ${validator}:`, error);
            validatorAprs[validator] = {
                apr: "0%",
                apr_full_num: "0"
            };
        }
    }

    return validatorAprs;
}

export async function CalculateProviderAprs(): Promise<Record<string, ProviderAprDetails>> {
    const providers = await ActiveProvidersService.fetch();
    if (!providers) {
        logger.error('No providers found');
        return {};
    }

    const providerDetails: Record<string, ProviderAprDetails> = {};

    for (const provider of providers) {
        try {
            const estimatedRewards = await RpcOnDemandEndpointCache.GetEstimatedProviderRewards(
                provider,
                LAVA_RPC_BENCHMARK_AMOUNT,
                LAVA_RPC_BENCHMARK_DENOM
            );

            const processed = await ProcessTokenArrayAtTime({
                info: estimatedRewards.info || [],
                total: estimatedRewards.total || [],
                recommended_block: estimatedRewards.recommended_block
            });

            const totalUsdValue = processed.total?.tokens.reduce((sum, token) => {
                const usdValue = new Decimal(token.value_usd.replace('$', '') || '0');
                return sum.plus(usdValue);
            }, new Decimal(0)) || new Decimal(0);

            const currentApr = await CalculateApr(totalUsdValue.toNumber(), `Provider APR for ${provider}`);

            // Store current APR in history
            await AprWeighted.StoreApr({
                apr: currentApr,
                source: 'provider',
                address: provider
            });

            // Get weighted APR
            const weightedApr = await AprWeighted.GetWeightedApr({
                source: 'provider',
                address: provider
            });

            // Use weighted APR if available, otherwise use current APR
            const finalApr = weightedApr ?? currentApr;

            providerDetails[provider] = {
                apr: formatToPercent(finalApr),
                apr_full_num: finalApr.toString(),
                rewards_10k_lava_delegation: processed.total?.tokens || []
            };

        } catch (error) {
            logger.error(`Failed to calculate APR for provider ${provider}:`, error);
            providerDetails[provider] = {
                apr: "0%",
                apr_full_num: "0",
                rewards_10k_lava_delegation: []
            };
        }
    }

    return providerDetails;
}
