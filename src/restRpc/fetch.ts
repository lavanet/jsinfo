import { logger } from "@jsinfo/utils/logger";
import { BackoffRetry } from "@jsinfo/utils/retry";

const activeFetches: Record<string, Promise<any>> = {};
const RATE_LIMIT_DELAY = 60000; // 1 minute in milliseconds
const rateDelayCache = new Map<string, number>();

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
        const maxRetries = 3; // Define the maximum number of retries
        let attempt = 0; // Initialize the attempt counter

        while (attempt < maxRetries) {
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
                    attempt++; // Increment the attempt counter
                    logger.info(`Retrying fetch for ${url} (Attempt ${attempt})...`);
                    continue; // Retry the fetch
                }

                // Check for other response errors
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json() as T; // Return the JSON response if successful
            } catch (error) {
                logger.error(`Error fetching data from ${url}:`, error);
                if (attempt === maxRetries - 1) {
                    throw error; // Rethrow the error if max retries reached
                }
                attempt++; // Increment the attempt counter
                logger.info(`Retrying fetch for ${url} (Attempt ${attempt})...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            }
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
    return await promise as T;
}
