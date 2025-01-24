import { logger } from '@jsinfo/utils/logger';
import { ConvertToBaseDenom, GetUSDCValue } from '@jsinfo/restRpc/CurrencyConverstionUtils';

interface TokenAmount {
    amount: string | number;
    denom: string;
}

interface ProcessedToken {
    amount: string;
    denom: string;
    original_denom: string;
    value_usd: string;
}

interface ProcessedTokenArray {
    tokens: ProcessedToken[];
    total_usd: number;
}

async function ProcessTokenArray(tokens: TokenAmount[]): Promise<ProcessedTokenArray> {
    const processedItems: ProcessedToken[] = [];
    let usdSum = 0;

    if (!tokens || tokens.length === 0) {
        return {
            tokens: [],
            total_usd: 0
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
        total_usd: usdSum
    };
}

export {
    ProcessTokenArray,
    TokenAmount,
    ProcessedTokenArray,
    ProcessedToken
};
