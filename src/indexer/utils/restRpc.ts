import { GetEnvVar } from "@jsinfo/utils/env";
import { logger } from "@jsinfo/utils/logger";
import { BackoffRetry } from "@jsinfo/utils/retry";

const activeFetches: Record<string, Promise<any>> = {};

export async function FetchRestData<T>(
    url: string,
    options: RequestInit = {},
    skipBackoff: boolean = false,
    retries: number = 8,
    factor: number = 2,
    minTimeout: number = 1000,
    maxTimeout: number = 5000
): Promise<T> {
    if (url in activeFetches) {
        // logger.debug(`FetchRestData:: Reusing existing fetch promise for ${url}`);
        return activeFetches[url] as Promise<T>;
    }

    const fetchFunc = async () => {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json() as T;
        } catch (error) {
            logger.error(`Failed to fetch data from ${url}`, { error });
            throw error;
        } finally {
            delete activeFetches[url];
        }
    };

    const promise = skipBackoff ?
        fetchFunc() :
        BackoffRetry(`FetchRestData: ${url}`, fetchFunc, retries, factor, minTimeout, maxTimeout);
    activeFetches[url] = promise;
    return promise;
}

export async function QueryLavaRPC<T>(path: string, skipBackoff: boolean = false): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    if (baseUrl.endsWith('/') && path.startsWith('/')) {
        path = path.slice(1);
    }
    const url = `${baseUrl}${path}`;
    return FetchRestData<T>(url, {}, skipBackoff);
}

