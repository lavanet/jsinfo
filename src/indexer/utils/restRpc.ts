import { GetEnvVar } from "@jsinfo/utils/env";
import { logger } from "@jsinfo/utils/logger";
import { BackoffRetry } from "@jsinfo/utils/retry";

const activeFetches: Record<string, Promise<any>> = {};
const RATE_LIMIT_DELAY = 60000; // 1 minute in milliseconds
const rateDelayCache = new Map<string, number>();
const errorCache = new Map<string, number>();

function rateLimitedError(message: string, error: any) {
    const key = `${message}-${error?.message || 'unknown'}`;
    const now = Date.now();
    const lastLogTime = errorCache.get(key) || 0;

    // Only log if more than 60 seconds have passed since last similar error
    if (now - lastLogTime >= 60000) {
        logger.error(message, { error });
        errorCache.set(key, now);
    }
}

export async function FetchRestData<T>(
    url: string,
    options: RequestInit = {},
    skipBackoff: boolean = false,
    retries: number = 8,
    factor: number = 2,
    minTimeout: number = 1000,
    maxTimeout: number = 5000
): Promise<T> {


    // Check if we need to wait due to previous rate limit
    const lastRateLimit = rateDelayCache.get(url);
    if (lastRateLimit) {
        const timeToWait = lastRateLimit - Date.now();
        if (timeToWait > 0) {
            logger.info(`Rate limit cooling down for URL: ${url}, waiting ${timeToWait}ms`);
            await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
        rateDelayCache.delete(url);
    }

    if (url in activeFetches) {
        return activeFetches[url] as Promise<T>;
    }

    const fetchFunc = async () => {
        try {
            const lastRateLimit = rateDelayCache.get(url);
            if (lastRateLimit) {
                const timeToWait = lastRateLimit - Date.now();
                if (timeToWait > 0) {
                    logger.info(`Rate limit cooling down for URL: ${url}, waiting ${timeToWait}ms`);
                    await new Promise(resolve => setTimeout(resolve, timeToWait));
                }
                rateDelayCache.delete(url);
            }
            const response = await fetch(url, options);

            // Handle rate limit (429) specifically
            if (response.status === 429) {
                logger.warn(`Rate limit hit for ${url}, waiting 60 seconds before retry`);
                rateDelayCache.set(url, Date.now() + RATE_LIMIT_DELAY);
                await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                throw new Error('Rate limited - retrying after delay');
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json() as T;
        } catch (error) {
            rateLimitedError(`Failed to fetch data from ${url}`, error);
            throw error;
        } finally {
            delete activeFetches[url];
        }
    };

    // Check for rate limit before making request
    const lastRateLimit2 = rateDelayCache.get(url);
    if (lastRateLimit2) {
        const timeToWait = lastRateLimit2 + RATE_LIMIT_DELAY - Date.now();
        if (timeToWait > 0) {
            logger.info(`Rate limit cooling down for URL: ${url}, waiting ${timeToWait}ms`);
            await new Promise(resolve => setTimeout(resolve, timeToWait));
            rateDelayCache.delete(url);
        }
    }

    const promise = skipBackoff ?
        fetchFunc() :
        BackoffRetry(`FetchRestData: ${url}`, fetchFunc, retries, factor, minTimeout, maxTimeout);
    activeFetches[url] = promise;
    return await promise;
}

export async function QueryLavaRPC<T>(path: string, skipBackoff: boolean = false): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    if (baseUrl.endsWith('/') && path.startsWith('/')) {
        path = path.slice(1);
    }
    const url = `${baseUrl}${path}`;
    return FetchRestData<T>(url, {}, skipBackoff);
}

