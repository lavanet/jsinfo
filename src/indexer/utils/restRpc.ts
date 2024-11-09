import { GetEnvVar, logger, BackoffRetry } from "../../utils/utils";

export async function FetchRestData<T>(
    url: string,
    options: RequestInit = {},
    skipBackoff: boolean = false,
    retries: number = 8,
    factor: number = 2,
    minTimeout: number = 1000,
    maxTimeout: number = 5000
): Promise<T> {
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
        }
    };

    if (skipBackoff) {
        return fetchFunc();
    } else {
        return BackoffRetry(`FetchRestData: ${url}`, fetchFunc, retries, factor, minTimeout, maxTimeout);
    }
}

export async function QueryLavaRPC<T>(path: string, skipBackoff: boolean = false): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    if (baseUrl.endsWith('/') && path.startsWith('/')) {
        path = path.slice(1);
    }
    const url = `${baseUrl}${path}`;
    return FetchRestData<T>(url, {}, skipBackoff);
}

