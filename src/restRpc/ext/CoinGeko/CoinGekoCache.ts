import { logger } from '@jsinfo/utils/logger';
import { IsMeaningfulText, TruncateError } from '@jsinfo/utils/fmt';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { FetchRestData } from '@jsinfo/restRpc/fetch';
import denomsData from "./CoinGekoDenomMap.json" assert { type: "json" };
import { IsMainnet } from '@jsinfo/utils/env';
const getCacheKey = (coinGeckodenom: string) => `coingecko-rate-${coinGeckodenom}`;

const MIN_ACCEPTABLE_RATE = 1.e-7;
const MAX_ACCEPTABLE_RATE = 100000;

export interface CoinGeckoRateResponse {
    [coinGeckodenom: string]: {
        usd: number
    };
}

class CoinGekoCacheClass {
    private cacheRefreshInterval = 30 * 60; // 30 minutes, I hit 2 much the retry error locally
    private activeFetches: { [denom: string]: Promise<number> } = {};

    public async GetLavaUSDRate(): Promise<number> {
        return await this.GetDenomToUSDRate("lava");
    }

    public async GetDenomToUSDRate(denom: string): Promise<number> {
        if (IsMainnet() && denom.includes("E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F")) {
            throw new Error(`Using testnet denom on mainnet - something is wrong - ${denom} (samoleans)`);
        }

        const coinGeckodenom = denomsData[denom as keyof typeof denomsData];
        if (!coinGeckodenom) {
            throw new Error(`CoinGekoCache:: No matching id found in denoms.json for ${denom}`);
        }

        const cacheKey = getCacheKey(coinGeckodenom);
        const cachedRate = await RedisCache.getDict(cacheKey);
        if (cachedRate) {
            return cachedRate.rate;
        }

        // Return existing promise if we're already fetching this denom
        if (coinGeckodenom in this.activeFetches) {
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
                const data = await FetchRestData<CoinGeckoRateResponse>(url);
                return data; // Return the fetched data if successful
            } catch (error: unknown) {
                const errorMessage = (error instanceof Error) ? error.message : 'Unknown error';
                logger.error(`Attempt ${attempt} to fetch data from ${url} failed: ${errorMessage}`);
                if (attempt < MAX_RETRIES) {
                    logger.info(`Waiting for 5 minutes before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, WAIT_TIME)); // Wait for 5 minutes
                } else {
                    logger.error(`All attempts to fetch data from ${url} failed.`);
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

            const cacheKey = getCacheKey(coinGeckodenom);
            if (usdRate < MIN_ACCEPTABLE_RATE) {
                logger.warn(`CoinGekoCache:: Fetched USD rate for ${coinGeckodenom} is too low: ${usdRate}`);
                const cachedRate = await RedisCache.getDict(cacheKey);
                if (cachedRate && IsMeaningfulText(cachedRate + '') && cachedRate?.rate != 0) return cachedRate.rate;
                RedisCache.setDict(
                    cacheKey,
                    { rate: 0 },
                    1 * 60 // 1 minute
                );
                return 0
            }

            if (usdRate > MAX_ACCEPTABLE_RATE) {
                logger.warn(`CoinGekoCache:: Fetched USD rate for ${coinGeckodenom} is too high: ${usdRate}`);
                const cachedRate = await RedisCache.getDict(cacheKey);
                if (cachedRate && IsMeaningfulText(cachedRate + '') && cachedRate?.rate != 0) return cachedRate.rate;
                RedisCache.setDict(
                    cacheKey,
                    { rate: 0 },
                    1 * 60 // 1 minute
                );
                return 0
            }

            RedisCache.setDict(
                getCacheKey(coinGeckodenom),
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