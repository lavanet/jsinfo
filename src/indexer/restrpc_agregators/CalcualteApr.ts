import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import { ConvertToBaseDenom, GetUSDCValue } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { EstimatedRewardsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/lavaRpcPeriodicEndpointCache';
import { IsTestnet } from '@jsinfo/utils/env';
import { logger } from '@jsinfo/utils/logger';
import Decimal from 'decimal.js';
import { ProcessTokenArrayAtTime } from '@jsinfo/restRpc/ProcessLavaRpcTokenArray';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

// Constants
export const LAVA_RPC_BENCHMARK_AMOUNT = 10000 * 1000000;
export const LAVA_RPC_BENCHMARK_DENOM = "ulava";
export const COINGEKO_API_BENCHMARK_AMOUNT = 10000;
export const COINGEKO_API_BENCHMARK_DENOM = "lava";

const APR_MAX_ERROR = 10000;
// we had values as 0.0020040648396455474
// was ok for 0.0001 on mainnet
const APR_MIN_WARM = IsTestnet() ? 1e-10 : 0.0000001;

export const PERCENTILE = 0.8;

export const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"];

// Add these variables at the top with other constants
const LOG_INTERVAL = 3 * 60 * 1000; // 3 minutes
let lastLogTime = 0;

export function CalculatePercentile(values: number[], rank: number, caller: string): number {
    const dataLen = values.length;
    if (dataLen === 0 || rank < 0.0 || rank > 1.0) {
        logger.warn('Invalid data for percentile calculation. Returning 0.');
        return 0;
    }

    if (values.length == 1) {
        return values[0];
    }

    // Sort values in ascending order
    values.sort((a, b) => a - b);

    // Calculate the position based on the rank using Decimal
    const position = new Decimal(dataLen - 1).times(rank).floor().toNumber();

    if (dataLen % 2 === 0) {
        // Interpolate between two middle values using Decimal
        const lower = new Decimal(values[position]);
        const upper = new Decimal(values[position + 1]);
        const result = lower.plus(upper.minus(lower).times(rank)).toNumber();
        return result;
    } else {
        const result = values[position];
        return result;
    }
}

// Replace the class method with a standalone function
export async function CalculateApr(totalReward: number, caller: string): Promise<number> {
    // this number is 932.82 on 04/12/24
    const investedAmount = await GetUSDCValue(COINGEKO_API_BENCHMARK_AMOUNT.toString(), COINGEKO_API_BENCHMARK_DENOM);

    const now = Date.now();
    if (now - lastLogTime >= LOG_INTERVAL) {
        logger.info(`[APR Monitor] CalculateAPR: usdc value for ${LAVA_RPC_BENCHMARK_AMOUNT} ${LAVA_RPC_BENCHMARK_DENOM} is ${investedAmount}`);
        lastLogTime = now;
    }

    const rate = new Decimal(totalReward).dividedBy(new Decimal(investedAmount));
    const one = new Decimal(1);
    const twelve = new Decimal(12);

    // Calculate ((1 + rate)^12 - 1) using Decimal
    const apr = one.plus(rate).pow(twelve).minus(one);
    const aprNum = apr.toNumber();

    if (!isFinite(aprNum)) {
        logger.error(`AprMon: ${caller} - APR is Infinity or -Infinity. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return 0;
    }

    if (aprNum < APR_MIN_WARM) {
        logger.warn(`AprMon: ${caller} - APR is too low. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return aprNum;
    }

    if (aprNum > APR_MAX_ERROR) {
        logger.warn(`AprMon: ${caller} - APR is too high. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return 0;
    }

    return aprNum;
}

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
    rewards_10k_lava_delegation: RewardAmount[];
}

function formatToPercent(value: number): string {
    if (!IsMeaningfulText("" + value)) return '-'; // Return '-' if the value is not a number
    return (value * 100).toFixed(4) + '%'; // Convert to percentage and format to one decimal place
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

            // Process rewards using ProcessTokenArrayAtTime
            const processed = await ProcessTokenArrayAtTime({
                info: estimatedRewards.info || [],
                total: estimatedRewards.total || [],
                recommended_block: estimatedRewards.recommended_block
            });

            console.log("provider", provider, "processed", processed);

            // Calculate total USD value from processed rewards
            const totalUsdValue = processed.total?.tokens.reduce((sum, token) => {
                const usdValue = new Decimal(token.value_usd.replace('$', '') || '0');
                return sum.plus(usdValue);
            }, new Decimal(0)) || new Decimal(0);

            // Calculate APR using existing function
            const apr = await CalculateApr(totalUsdValue.toNumber(), `Provider APR for ${provider}`);

            // Format rewards amounts with exact field names
            const rewards = processed.total?.tokens.map(token => ({
                source_denom: token.source_denom,
                resolved_amount: token.resolved_amount,
                resolved_denom: token.resolved_denom,
                display_denom: token.display_denom,
                display_amount: token.display_amount,
                value_usd: token.value_usd
            })) || [];

            providerDetails[provider] = {
                apr: formatToPercent(apr),
                rewards_10k_lava_delegation: rewards
            };

        } catch (error) {
            logger.error(`Failed to calculate APR for provider ${provider}:`, error);
            providerDetails[provider] = {
                apr: "0%",
                rewards_10k_lava_delegation: []
            };
        }
    }

    return providerDetails;
}
