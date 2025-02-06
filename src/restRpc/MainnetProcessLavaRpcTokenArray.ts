import { logger } from '@jsinfo/utils/logger';
import { ConvertToBaseDenom, GetUSDCValue, GetDenomTrace } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { ProcessedInfoItem } from '@jsinfo/redis/resources/MainnetProviderEstimatedRewards/MainnetGenLavaLatestProviderRewards';
import Decimal from 'decimal.js';
import { TEST_DENOMS } from '@jsinfo/indexer/restrpc_agregators/CalcualteApr';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

interface EstimatedRewardsResponse {
    info: {
        source: string;
        amount: {
            denom: string;
            amount: string;
        };  // Single object, not array
    }[];
    total: {
        denom: string;
        amount: string;
    }[];
    recommended_block?: string;
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

export function FormatTokenAmount(amount: string | number): string {
    // Create a new Decimal instance
    const decimal = new Decimal(amount);

    // Convert to string with high precision
    const str = decimal.toFixed(20);

    // Split into whole and decimal parts
    const [whole, fraction] = str.split('.');

    // If no decimal part, return whole number
    if (!fraction) return whole;

    // Trim trailing zeros
    const trimmedFraction = fraction.replace(/0+$/, '');

    // If decimal part is empty after trimming zeros, return whole number
    if (!trimmedFraction) return whole;

    // If decimal part is significant (not just zeros), return with decimal
    return `${whole}.${trimmedFraction}`;
}

export async function ProcessTokenArrayAtTime(response: EstimatedRewardsResponse, timestamp: number | null = null): Promise<ProcessedTokenArray> {
    const processedItems: ProcessedInfoItem[] = [];
    const processedTotalTokens: ProcessedToken[] = [];
    let totalUsd = 0;

    // Process info array
    if (response.info) {
        for (const item of response.info) {
            try {
                if (TEST_DENOMS.includes(item.amount[0].denom)) continue;

                const tokenAmount = item.amount[0]; // Back to array access
                const [baseAmount, baseDenom] = await ConvertToBaseDenom(tokenAmount.amount, tokenAmount.denom);
                const usdValue = await GetUSDCValue(baseAmount, baseDenom);

                const originalDenom = (baseDenom && baseDenom.startsWith('ibc/')) ?
                    await GetDenomTrace(baseDenom) :
                    tokenAmount.denom;

                const processedToken = {
                    source_denom: tokenAmount.denom,
                    resolved_amount: FormatTokenAmount(tokenAmount.amount),
                    resolved_denom: originalDenom,
                    display_denom: baseDenom,
                    display_amount: FormatTokenAmount(baseAmount),
                    value_usd: `$${FormatTokenAmount(usdValue)}`
                };

                processedItems.push({
                    source: item.source,
                    amount: {
                        tokens: [processedToken],
                        total_usd: new Decimal(usdValue).toNumber()
                    }
                });
                totalUsd += new Decimal(usdValue).toNumber();

                // Store in coingecko prices map
                const prices = getCoingeckoPricesResolvedMap(timestamp);
                prices[tokenAmount.denom] = {
                    source_denom: tokenAmount.denom,
                    resolved_denom: originalDenom,
                    display_denom: baseDenom,
                    value_usd: usdValue
                };
            } catch (error) {
                logger.error('Failed to process provider rewards info:', {
                    error: error instanceof Error ? error.message : error,
                    item: JSON.stringify(item),
                    source: item?.source,
                    amount: item?.amount,
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        }
    }

    // Process total array
    if (response.total) {
        let totalTokensUsd = new Decimal(0);
        for (const total of response.total) {
            try {
                const [baseAmount, baseDenom] = await ConvertToBaseDenom(total.amount, total.denom);
                const usdValue = await GetUSDCValue(baseAmount, baseDenom);
                const originalDenom = total.denom.startsWith('ibc/') ?
                    await GetDenomTrace(total.denom) :
                    total.denom;

                const usdDecimal = new Decimal(usdValue);
                totalTokensUsd = totalTokensUsd.plus(usdDecimal);

                processedTotalTokens.push({
                    source_denom: total.denom,
                    resolved_amount: FormatTokenAmount(total.amount),
                    resolved_denom: originalDenom,
                    display_denom: baseDenom,
                    display_amount: FormatTokenAmount(baseAmount),
                    value_usd: `$${FormatTokenAmount(usdValue)}`
                });

                // Store total tokens in coingecko prices map too
                const prices = getCoingeckoPricesResolvedMap(timestamp);
                prices[total.denom] = {
                    source_denom: total.denom,
                    resolved_denom: originalDenom,
                    display_denom: baseDenom,
                    value_usd: usdValue
                };
            } catch (error) {
                logger.error('Error processing total token:', error);
            }
        }
        totalUsd = totalTokensUsd.toNumber();
    }

    return {
        tokens: processedTotalTokens,
        total_usd: totalUsd,
        info: processedItems,
        total: {
            tokens: processedTotalTokens,
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

export interface MinimalToken {
    denom: string;
    amount: string;
}

export interface ProcessedMinimalTokenArray {
    tokens: ProcessedToken[];
    total_usd: number;
}

export async function ProcessMinimalTokenArray(tokens: MinimalToken[]): Promise<ProcessedMinimalTokenArray> {
    try {
        const processedTokens: ProcessedToken[] = [];
        let totalTokensUsd = new Decimal(0);

        for (const token of tokens) {
            try {
                if (TEST_DENOMS.includes(token.denom)) continue;

                const [baseAmount, baseDenom] = await ConvertToBaseDenom(token.amount, token.denom);
                const usdValue = await GetUSDCValue(baseAmount, baseDenom);
                const originalDenom = token.denom.startsWith('ibc/') ?
                    await GetDenomTrace(token.denom) :
                    token.denom;

                const usdDecimal = new Decimal(usdValue);
                totalTokensUsd = totalTokensUsd.plus(usdDecimal);

                processedTokens.push({
                    source_denom: token.denom,
                    resolved_amount: FormatTokenAmount(token.amount),
                    resolved_denom: originalDenom,
                    display_denom: baseDenom,
                    display_amount: FormatTokenAmount(baseAmount),
                    value_usd: `$${FormatTokenAmount(usdValue)}`
                });

            } catch (error) {
                logger.error('Error processing token:', { error, token });
            }
        }

        return {
            tokens: processedTokens,
            total_usd: totalTokensUsd.toNumber()
        };
    } catch (error) {
        logger.error('Failed to process minimal token array:', error);
        return {
            tokens: [],
            total_usd: 0
        };
    }
}

