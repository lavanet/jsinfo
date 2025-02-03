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

export async function processTokenArrayAtTime(items: any[], timestamp: number | null = null): Promise<ProcessedTokenArray> {
    const processedItems: ProcessedInfoItem[] = [];
    const processedTokens: ProcessedToken[] = [];
    let totalUsd = 0;

    const key = timestamp === null ? "latest" : timestamp.toString();
    if (!COINGECKO_PRICES_RESOLVED_MAP[key]) {
        COINGECKO_PRICES_RESOLVED_MAP[key] = {};
    }

    for (const item of items) {
        try {
            const tokenAmount = item.amount[0];
            const [baseAmount, baseDenom] = await ConvertToBaseDenom(tokenAmount.amount, tokenAmount.denom);
            const usdValue = await GetUSDCValue(baseAmount, baseDenom);
            const originalDenom = tokenAmount.denom.startsWith('ibc/') ?
                await GetDenomTrace(tokenAmount.denom) :
                tokenAmount.denom;

            const processedToken = {
                source_denom: tokenAmount.denom,
                resolved_amount: baseAmount,
                resolved_denom: originalDenom,
                display_denom: baseDenom,
                display_amount: (parseFloat(baseAmount) / 1000000).toString(),
                value_usd: `$${parseFloat(usdValue).toFixed(2)}`
            };

            processedTokens.push(processedToken);

            // Cache the price info
            COINGECKO_PRICES_RESOLVED_MAP[key][baseDenom] = {
                source_denom: tokenAmount.denom,
                resolved_denom: originalDenom,
                display_denom: baseDenom,
                value_usd: `$${parseFloat(usdValue).toFixed(2)}`
            };

            processedItems.push({
                source: item.source,
                amount: {
                    tokens: [processedToken],
                    total_usd: parseFloat(usdValue)
                }
            });
            totalUsd += parseFloat(usdValue);
        } catch (error) {
            logger.error('Error processing token:', error);
            continue;
        }
    }

    return {
        tokens: processedTokens,
        total_usd: totalUsd,
        info: processedItems,
        total: {
            tokens: processedTokens,
            total_usd: totalUsd
        }
    };
}

export function getCoingeckoPricesResolvedMap(timestamp: number | null = null): Record<string, CoinGeckoPriceInfo> {
    const key = timestamp === null ? "latest" : timestamp.toString();
    if (!COINGECKO_PRICES_RESOLVED_MAP[key]) {
        COINGECKO_PRICES_RESOLVED_MAP[key] = {};
    }
    return COINGECKO_PRICES_RESOLVED_MAP[key];
}

