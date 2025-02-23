import { GetUSDCValue } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { logger } from '@jsinfo/utils/logger';
import Decimal from 'decimal.js';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';



// Constants
export const LAVA_RPC_BENCHMARK_AMOUNT = 10000 * 1000000;
export const LAVA_RPC_BENCHMARK_DENOM = "ulava";
export const COINGEKO_API_BENCHMARK_AMOUNT = 10000;
export const COINGEKO_API_BENCHMARK_DENOM = "lava";

const APR_MAX_WARN = 100;
const APR_MIN_WARM = 0.00000000001;

export const PERCENTILE = 0.8;

export const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"];

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
    if (!IsMeaningfulText(caller)) {
        throw new Error("Caller is not meaningful: " + caller);
    }

    const investedAmount = await GetUSDCValue(COINGEKO_API_BENCHMARK_AMOUNT.toString(), COINGEKO_API_BENCHMARK_DENOM);

    const rate = new Decimal(totalReward).dividedBy(new Decimal(investedAmount));
    const one = new Decimal(1);
    const twelve = new Decimal(12);

    const apr = one.plus(rate).pow(twelve).minus(one);
    const aprNum = apr.toNumber();

    // Restore validation checks
    if (!isFinite(aprNum)) {
        logger.error(`AprMon: ${caller} - APR is Infinity or -Infinity. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return 0;
    }

    if (aprNum < APR_MIN_WARM) {
        logger.warn(`AprMon: ${caller} - APR is too low. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return 0;
    }

    if (aprNum > APR_MAX_WARN) {
        logger.warn(`AprMon: ${caller} - APR is too high. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${aprNum}`);
        return 0;
    }

    return aprNum;
}



