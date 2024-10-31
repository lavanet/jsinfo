import { logger, TruncateError } from "../../../utils/utils";
import { MemoryCache } from "../MemoryCache";
import { FetchRestData } from "../../utils/restRpc";
import denomsData from "./CoinGekoDenomMap.json" assert { type: "json" };

export interface CoinGeckoRateResponse {
    [coinGeckodenom: string]: {
        usd: number
    };
}

class CoinGekoCacheClass {
    private cacheRefreshInterval = 5 * 60; // 5 minutes

    public async GetDenomToUSDRate(denom: string): Promise<number> {
        const coinGeckodenom = denomsData[denom as keyof typeof denomsData];
        if (!coinGeckodenom) {
            throw new Error(`No matching id found in denoms.json for ${denom}`);
        }

        const cacheKey = `coingecko-rate-${coinGeckodenom}`;
        const cachedRate = await MemoryCache.getDict(cacheKey);
        if (cachedRate) {
            return cachedRate.rate;
        }

        await this.fetchAndCacheDenomRate(coinGeckodenom);
        const newCachedRate = await MemoryCache.getDict(cacheKey);
        if (!newCachedRate) {
            throw new Error(`Failed to cache rate for ${coinGeckodenom}`);
        }

        return newCachedRate.rate;
    }

    private async fetchAndCacheDenomRate(coinGeckodenom: string): Promise<void> {
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
            logger.info(`Fetched and cached USD rate for ${coinGeckodenom}: ${usdRate}`);
        } catch (error) {
            logger.error(`Error fetching USD rate for ${coinGeckodenom}`, { error: TruncateError(error) });
            throw error;
        }
    }
}

export const CoinGekoCache = new CoinGekoCacheClass();