import axios from 'axios';
import { GetEnvVar, logger, BackoffRetry } from "../../utils/utils";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { MemoryCache } from "../classes/MemoryCache";

export async function fetchData<T>(
    url: string, 
    options: RequestInit = {}, 
    skipBackoff: boolean = false,
    retries: number = 8,
    factor: number = 2,
    minTimeout: number = 1000,
    maxTimeout: number = 5000
): Promise<T> {
    const fetchDataFunc = async () => {
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
        return fetchDataFunc();
    } else {
        return BackoffRetry(`fetchData: ${url}`, fetchDataFunc, retries, factor, minTimeout, maxTimeout);
    }
}

export async function QueryLavaRPC<T>(path: string, skipBackoff: boolean = false): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    const url = `${baseUrl}${path}`;
    return fetchData<T>(url, {}, skipBackoff);
}

export function ReplaceForCompare(data: any): string {
    if (data === null) {
        return "null";
    }

    if (typeof data === "number" && data === 0) {
        return "0";
    }

    if (typeof data === "object") {
        // Remove 'block_report' key if it exists
        if (Array.isArray(data)) {
            data = data.map(item => typeof item === 'object' ? RemoveKey(item, 'block_report') : item);
        } else {
            data = RemoveKey(data, 'block_report');
        }
        data = JSON.stringify(data);
    }

    if (typeof data !== "string") {
        data = String(data);
    }

    return data.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/\t/g, '')
        .replace(/\n/g, '');
}

export function RemoveKey(obj: any, keyToRemove: string): any {
    if (Array.isArray(obj)) {
        return obj.map(item => RemoveKey(item, keyToRemove));
    }

    if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            if (key !== keyToRemove) {
                acc[key] = RemoveKey(obj[key], keyToRemove);
            }
            return acc;
        }, {} as any);
    }

    return obj;
}

export async function EnsureConsumerVerified(db: PostgresJsDatabase, consumer: string): Promise<void> {
    const verifiedConsumerKey = `verified_consumer_${consumer}`;

    try {
        const verified = await MemoryCache.get(verifiedConsumerKey);
        if (verified && verified.toLowerCase() === 'valid') {
            return;
        }

        await db.insert(JsinfoSchema.consumers)
            .values({ address: consumer })
            .onConflictDoNothing();


        await MemoryCache.set(verifiedConsumerKey, 'valid', 86400); // 86400 seconds = 1 day

    } catch (error) {
        logger.error('Error ensuring consumer exists', { consumer, error });
        throw new Error('Error ensuring consumer exists');
    }
}

export async function EnsureProviderVerified(db: PostgresJsDatabase, provider: string, moniker: string): Promise<void> {
    const verifiedProviderKey = `verified_provider_${provider}`;

    try {
        const verified = await MemoryCache.get(verifiedProviderKey);
        if (verified && verified.toLowerCase() === 'valid') {
            return;
        }

        await db.insert(JsinfoSchema.providers)
            .values({ address: provider, moniker })
            .onConflictDoUpdate({
                target: JsinfoSchema.providers.address,
                set: { moniker }
            });


        await MemoryCache.set(verifiedProviderKey, 'valid', 86400); // 86400 seconds = 1 day

    } catch (error) {
        logger.error('Error ensuring provider exists', { provider, moniker, error });
        throw new Error('Error ensuring provider exists');
    }
}


export function calculatePercentile(values: number[], rank: number): number {
    const dataLen = values.length;
    if (dataLen === 0 || rank < 0.0 || rank > 1.0) {
        return 0;
    }

    // Sort values in ascending order
    values.sort((a, b) => a - b);

    // Calculate the position based on the rank
    const position = Math.floor((dataLen - 1) * rank);

    if (dataLen % 2 === 0) {
        // Interpolate between two middle values
        const lower = values[position];
        const upper = values[position + 1];
        return lower + (upper - lower) * rank;
    } else {
        return values[position];
    }
}
