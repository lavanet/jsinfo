import { logger } from '@jsinfo/utils/logger';
import { ConvertToBaseDenom, GetUSDCValue } from '@jsinfo/restRpc/CurrencyConverstionUtils';
import { ProcessedInfoItem } from '@jsinfo/redis/resources/MainnetProviderEstimatedRewards/MainnetGenLavaLatestProviderRewards';

export interface TokenAmount {
    amount: string | number;
    denom: string;
}

export interface ProcessedToken {
    amount: string;
    denom: string;
    original_denom: string;
    value_usd: string;
}

interface ProcessedTokenArray {
    tokens: ProcessedToken[];
    total_usd: number;
    total?: {
        tokens: ProcessedToken[];
        total_usd: number;
    };
    info?: ProcessedInfoItem[];
    recommended_block?: string;
}

interface CoinGeckoPriceInfo {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    price: number;
}

// Global price cache map
const COINGECKO_PRICES_RESOLVED_MAP: Record<string, Record<string, CoinGeckoPriceInfo>> = {};

export function getCoingeckoPricesResolvedMap(timestamp: number | null = null): Record<string, CoinGeckoPriceInfo> {
    const key = timestamp === null ? "latest" : timestamp.toString();
    if (!COINGECKO_PRICES_RESOLVED_MAP[key]) {
        COINGECKO_PRICES_RESOLVED_MAP[key] = {};
    }
    return COINGECKO_PRICES_RESOLVED_MAP[key];
}

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

    if (!tokens || tokens.length === 0) {
        return {
            tokens: [],
            total_usd: 0,
            info: []
        };
    }

    for (const token of tokens) {
        try {
            if (!token || !('amount' in token) || !('denom' in token)) {
                logger.error('ProcessTokenArray: Invalid token format:', {
                    invalidToken: {
                        value: token,
                        type: typeof token,
                        hasAmount: token && 'amount' in token,
                        hasDenom: token && 'denom' in token
                    },
                    context: {
                        allTokens: JSON.stringify(tokens, null, 2),
                        processedCount: processedItems.length,
                        remainingTokens: tokens.length - processedItems.length
                    }
                });
                continue;
            }

            const [baseAmount, baseDenom] = await ConvertToBaseDenom(token.amount.toString(), token.denom);
            const usdValue = await GetUSDCValue(baseAmount, baseDenom);

            const processed: ProcessedToken = {
                amount: token.amount.toString(),
                denom: baseDenom,
                original_denom: token.denom,
                value_usd: `$${parseFloat(usdValue).toFixed(2)}`
            };

            processedItems.push(processed);
            usdSum += parseFloat(usdValue);

            const priceInfo: CoinGeckoPriceInfo = {
                source_denom: token.denom,
                resolved_denom: baseDenom,
                display_denom: baseDenom,
                price: parseFloat(usdValue)
            };

            // Cache the price info
            COINGECKO_PRICES_RESOLVED_MAP[key][baseDenom] = priceInfo;

        } catch (error) {
            logger.error('ProcessTokenArray: Token processing failed:', {
                failedToken: {
                    raw: token,
                    stringified: JSON.stringify(token, null, 2),
                    hasAmount: token && 'amount' in token,
                    hasDenom: token && 'denom' in token,
                    amountType: token?.amount ? typeof token.amount : 'undefined',
                    denomType: token?.denom ? typeof token.denom : 'undefined'
                },
                processingState: {
                    processedTokensCount: processedItems.length,
                    totalTokensCount: tokens.length,
                    processedTokens: processedItems,
                    remainingTokens: tokens.slice(processedItems.length)
                },
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    fullError: JSON.stringify(error, null, 2)
                } : error,
                context: {
                    allTokens: JSON.stringify(tokens, null, 2),
                    currentIndex: processedItems.length
                }
            });
            throw error;
        }
    }

    if (processedItems.length === 0) {
        logger.error('ProcessTokenArray: No tokens were successfully processed:', {
            inputTokens: JSON.stringify(tokens, null, 2),
            totalAttempted: tokens.length
        });
    }

    return {
        tokens: processedItems,
        total_usd: usdSum,
        info: []
    };
}

