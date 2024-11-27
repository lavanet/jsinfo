import { logger } from '@jsinfo/utils/logger';
import { TruncateError } from '@jsinfo/utils/fmt';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { FetchRestData } from '@jsinfo/restRpc/restRpc';
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
        const cachedRate = await RedisCache.getDict(cacheKey);
        if (cachedRate) {
            return cachedRate.rate;
        }

        // Return existing promise if we're already fetching this denom
        if (coinGeckodenom in this.activeFetches) {
            // logger.info(`CoinGekoCache:: Reusing existing fetch promise for ${coinGeckodenom}`);
            return this.activeFetches[coinGeckodenom];
        }

        // Create new promise for this denom
        this.activeFetches[coinGeckodenom] = this.fetchAndCacheDenomRate(coinGeckodenom)
            .finally(() => {
                delete this.activeFetches[coinGeckodenom];
            });

        return this.activeFetches[coinGeckodenom];
    }



    private async fetchWithRetry(url: string): Promise<CoinGeckoRateResponse> {
        const MAX_RETRIES = 3; // Maximum number of retries
        const WAIT_TIME = 300000; // 5 minutes in milliseconds

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const data = await FetchRestData<CoinGeckoRateResponse>(
                    url,
                    {},
                    false,
                    3,  // retries 
                    2,  // backoff
                    1200, // timeout
                    5000  // delay
                );
                return data; // Return the fetched data if successful
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
                console.error(`Attempt ${attempt} to fetch data from ${url} failed: ${errorMessage}`);
                if (attempt < MAX_RETRIES) {
                    console.log(`Waiting for 5 minutes before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, WAIT_TIME)); // Wait for 5 minutes
                } else {
                    console.error(`All attempts to fetch data from ${url} failed.`);
                    throw error; // Rethrow the error after the last attempt
                }
            }
        }
        throw new Error(`No data fetched for ${url}`);
    }

    private async fetchAndCacheDenomRate(coinGeckodenom: string): Promise<number> {
        try {
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckodenom}&vs_currencies=usd`;
            const data = await this.fetchWithRetry(url);

            const usdRate = data[coinGeckodenom]?.usd;
            if (!usdRate) {
                throw new Error(`No USD rate found for ${coinGeckodenom}`);
            }

            await RedisCache.setDict(
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