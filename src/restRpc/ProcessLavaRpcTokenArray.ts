import { logger } from '@jsinfo/utils/logger';
import { ConvertToBaseDenom, GetUSDCValue, GetDenomTrace } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { ProcessedInfoItem } from '@jsinfo/redis/resources/MainnetProviderEstimatedRewards/MainnetGenLavaLatestProviderRewards';

export interface TokenAmount {
    amount: string | number;
    denom: string;
}

export interface ProcessedToken {
    source_denom: string;
    resolved_amount: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    value_usd: string;
}

export interface ProcessedTokenArray {
    tokens: ProcessedToken[];
    total_usd: number;
    total?: {
        tokens: ProcessedToken[];
        total_usd: number;
    };
    info?: ProcessedInfoItem[];
    recommended_block?: string;
}

export interface CoinGeckoPriceInfo {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    value_usd: string;
}
// Global price cache map
const COINGECKO_PRICES_RESOLVED_MAP: Record<string, Record<string, CoinGeckoPriceInfo>> = {};

export async function processTokenArrayAtTime(
    tokens: TokenAmount[],
    timestamp: number | null = null
): Promise<ProcessedTokenArray> {
    const processedItems: ProcessedToken[] = [];
    let usdSum = 0;

    const key = timestamp === null ? "latest" : timestamp.toString();
    if (!COINGECKO_PRICES_RESOLVED_MAP[key]) {
        COINGECKO_PRICES_RESOLVED_MAP[key] = {};
    }

    for (const token of tokens) {
        try {
            if (!token || !('amount' in token) || !('denom' in token)) {
                logger.warn('[Token Error] Token missing required fields:', token);
                continue;
            }

            const amount = parseFloat(token.amount.toString());
            const sourceDenom = token.denom;

            if (!sourceDenom) {
                logger.warn('[Token Error] Token has no denom:', token);
                continue;
            }

            const [baseAmount, baseDenom] = await ConvertToBaseDenom(amount.toString(), sourceDenom);
            const usdValue = await GetUSDCValue(baseAmount, baseDenom);

            // Get the original denom from IBC trace
            let originalDenom = sourceDenom;
            if (sourceDenom.startsWith('ibc/')) {
                originalDenom = await GetDenomTrace(sourceDenom);
            }

            const processed: ProcessedToken = {
                source_denom: sourceDenom,
                resolved_amount: amount.toString(),
                resolved_denom: originalDenom,
                display_denom: baseDenom,
                display_amount: baseAmount,
                value_usd: `$${parseFloat(usdValue)}`
            };

            // Cache the price info with string values
            COINGECKO_PRICES_RESOLVED_MAP[key][baseDenom] = {
                source_denom: sourceDenom,
                resolved_denom: originalDenom,
                display_denom: baseDenom,
                value_usd: `$${parseFloat(usdValue)}`
            };

            processedItems.push(processed);
            usdSum += parseFloat(usdValue);

        } catch (error) {
            logger.warn('[Token Error] Failed to process token:', {
                token,
                error: error instanceof Error ? error.message : error
            });
            continue;
        }
    }

    return {
        tokens: processedItems,
        total_usd: usdSum,
        info: []
    };
}

export function getCoingeckoPricesResolvedMap(timestamp: number | null = null): Record<string, CoinGeckoPriceInfo> {
    const key = timestamp === null ? "latest" : timestamp.toString();
    if (!COINGECKO_PRICES_RESOLVED_MAP[key]) {
        COINGECKO_PRICES_RESOLVED_MAP[key] = {};
    }
    return COINGECKO_PRICES_RESOLVED_MAP[key];
}

