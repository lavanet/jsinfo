import axios from 'axios';
import { GetEnvVar, logger, BackoffRetry } from "../../utils/utils";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RedisCache } from '../../query/classes/RedisCache';

export async function QueryLavaRPC<T>(path: string): Promise<T> {
    const baseUrl = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL");
    const url = `${baseUrl}${path}`;

    return BackoffRetry(`QueryLavaRPC: ${path}`, async () => {
        try {
            const response = await axios.get<T>(url);
            return response.data;
        } catch (error) {
            logger.error(`Failed to fetch data from ${url}`, { error });
            throw error;
        }
    });
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
        // Check Redis cache first
        const verified = await RedisCache.get(verifiedConsumerKey);
        if (verified && verified.toLowerCase() === 'valid') {
            return;
        }

        // If not in cache, insert into database
        await db.insert(JsinfoSchema.consumers)
            .values({ address: consumer })
            .onConflictDoNothing();

        // Set Redis cache
        await RedisCache.set(verifiedConsumerKey, 'valid', 86400); // 86400 seconds = 1 day

    } catch (error) {
        logger.error('Error ensuring consumer exists', { consumer, error });
        throw new Error('Error ensuring consumer exists');
    }
}

export async function EnsureProviderVerified(db: PostgresJsDatabase, provider: string, moniker: string): Promise<void> {
    const verifiedProviderKey = `verified_provider_${provider}`;

    try {
        // Check Redis cache first
        const verified = await RedisCache.get(verifiedProviderKey);
        if (verified && verified.toLowerCase() === 'valid') {
            return;
        }

        // If not in cache, insert into database
        await db.insert(JsinfoSchema.providers)
            .values({ address: provider, moniker })
            .onConflictDoUpdate({
                target: JsinfoSchema.providers.address,
                set: { moniker }
            });

        // Set Redis cache
        await RedisCache.set(verifiedProviderKey, 'valid', 86400); // 86400 seconds = 1 day

    } catch (error) {
        logger.error('Error ensuring provider exists', { provider, moniker, error });
        throw new Error('Error ensuring provider exists');
    }
}