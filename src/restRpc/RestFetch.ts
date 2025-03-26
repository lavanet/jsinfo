import { logger } from "@jsinfo/utils/logger";
import axios, { AxiosRequestConfig } from "axios";

const activeFetches: Record<string, Promise<any>> = {};

const HTTP_RETRY_CODES = {
    429: { delay: 60000, message: 'Rate Limited' },
    500: { delay: 5000, message: 'Internal Server Error' },
    502: { delay: 5000, message: 'Bad Gateway' },
    503: { delay: 5000, message: 'Service Unavailable' },
    504: { delay: 5000, message: 'Gateway Timeout' }
};

// Add a function to check for provider stake errors
function isProviderStakeError(data: any): boolean {
    return data?.code === 2 &&
        data?.message &&
        (data.message.includes('provider not staked on chain') ||
            data.message.includes('cannot get stake entry'));
}

async function doFetch<T>(
    url: string,
    options: AxiosRequestConfig = {},
    maxRetries: number = 8,
    retryDelay: number = 500,
    timeout: number = 30000
): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await axios({
                url,
                timeout,
                validateStatus: null,
                ...options
            });

            if (response.status !== 200) {
                // Check for provider stake errors
                if (isProviderStakeError(response.data)) {
                    // logger.debug(`Provider stake error for ${url}: ${response.data.message}`);
                    throw new EntryDoesNotExistException(response.data.message);
                }

                // Check for "does not exist" error
                if (response.data?.code === 2 && (response.data?.message?.toLowerCase().includes('does not exist') || response.data?.message?.toLowerCase().includes('not found'))) {
                    throw new EntryDoesNotExistException(response.data.message);
                }

                const retryConfig = HTTP_RETRY_CODES[response.status];
                if (retryConfig) {
                    logger.warn(`${retryConfig.message} (${response.status}) for ${url}, waiting ${retryConfig.delay / 1000}s before retry`);
                    await new Promise(resolve => setTimeout(resolve, retryConfig.delay));
                    attempt++;
                    logger.info(`Retrying fetch for ${url} (Attempt ${attempt}/${maxRetries})...`);
                    continue;
                }

                throw new Error(`HTTP ${response.status} for ${url}\nResponse: ${JSON.stringify(response.data).slice(0, 200)}`);
            }

            return response.data;
        } catch (error) {
            if (error instanceof EntryDoesNotExistException) throw error;
            if (attempt === maxRetries - 1) throw error;
            attempt++;
            logger.error(`Error fetching data from ${url}:`, axios.isAxiosError(error) ? error.message : error);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
    throw new Error(`Max retries (${maxRetries}) exceeded for ${url}`);
}

export class EntryDoesNotExistException extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EntryDoesNotExistException';
    }
}

export async function FetchRestData<T>(
    url: string,
    options: AxiosRequestConfig = {},
    maxRetries?: number,
    retryDelay?: number,
    timeout?: number
): Promise<T> {
    if (url in activeFetches) {
        return activeFetches[url] as Promise<T>;
    }

    const promise = doFetch<T>(url, options, maxRetries, retryDelay, timeout);
    activeFetches[url] = promise;

    try {
        return await promise;
    } finally {
        delete activeFetches[url];
    }
}
