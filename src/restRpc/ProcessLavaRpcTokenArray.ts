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

    for (const token of tokens) {
        try {
            if (!token || !('amount' in token) || !('denom' in token)) {
                logger.warn(`Invalid token format: ${JSON.stringify(token)}`);
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
            logger.error(`Failed to process token: ${JSON.stringify(token)}`, error);
            continue;
        }
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
