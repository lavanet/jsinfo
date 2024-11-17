import { logger } from '@jsinfo/utils/logger';
import { TruncateError } from '@jsinfo/utils/fmt';
import { MemoryCache } from '@jsinfo/indexer/classes/MemoryCache';
import { FetchRestData } from '@jsinfo/indexer/utils/restRpc';
import denomsData from "./CoinGekoDenomMap.json" assert { type: "json" };

export interface CoinGeckoRateResponse {
    [coinGeckodenom: string]: {
        usd: number
    };
}

class CoinGekoCacheClass {
    private cacheRefreshInterval = 5 * 60; // 5 minutes
    private activeFetches: { [denom: string]: Promise<number> } = {};

    public async GetDenomToUSDRate(denom: string): Promise<number> {
        const coinGeckodenom = denomsData[denom as keyof typeof denomsData];
        if (!coinGeckodenom) {
            throw new Error(`CoinGekoCache:: No matching id found in denoms.json for ${denom}`);
        }

        const cacheKey = `coingecko-rate-${coinGeckodenom}`;
        const cachedRate = await MemoryCache.getDict(cacheKey);
        if (cachedRate) {
            return cachedRate.rate;
        }

        // Return existing promise if we're already fetching this denom
        if (coinGeckodenom in this.activeFetches) {
            logger.info(`CoinGekoCache:: Reusing existing fetch promise for ${coinGeckodenom}`);
            return this.activeFetches[coinGeckodenom];
        }

        // Create new promise for this denom
        this.activeFetches[coinGeckodenom] = this.fetchAndCacheDenomRate(coinGeckodenom)
            .finally(() => {
                delete this.activeFetches[coinGeckodenom];
            });

        return this.activeFetches[coinGeckodenom];
    }

    private async fetchAndCacheDenomRate(coinGeckodenom: string): Promise<number> {
        try {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckodenom}&vs_currencies=usd`;
            const data = await FetchRestData<CoinGeckoRateResponse>(
                url,
                {},
                false,
                3,  // retries 
                2,  // backoff
                1200, // timeout
                5000  // delay
            );

            const usdRate = data[coinGeckodenom]?.usd;
            if (!usdRate) {
                throw new Error(`No USD rate found for ${coinGeckodenom}`);
            }

            await MemoryCache.setDict(
                `coingecko-rate-${coinGeckodenom}`,
                { rate: usdRate },
                this.cacheRefreshInterval
            );
            logger.info(`CoinGekoCache:: Fetched and cached USD rate for ${coinGeckodenom}: ${usdRate}`);

            return usdRate;
        } catch (error) {
            logger.error(`CoinGekoCache:: Error fetching USD rate for ${coinGeckodenom}`, { error: TruncateError(error) });
            throw error;
        }
    }
}

export const CoinGekoCache = new CoinGekoCacheClass();