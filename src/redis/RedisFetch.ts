import { RedisCache } from "@jsinfo/redis/classes/RedisCache";
import { FetchRestData } from "../restRpc/RestFetch";
import { logger } from "@jsinfo/utils/logger";

export async function RedisFetch<T>(url: string, ttl: number = 1200): Promise<T> {
    // Check if the data is in the cache
    const cachedData = await RedisCache.get("url:" + url);
    if (cachedData) {
        // logger.info(`Cache hit for URL: ${url}`); // Log cache hit
        return JSON.parse(cachedData) as T; // Return cached data
    }

    // If not in cache, fetch the data from the API
    // logger.info(`Fetching data from API for URL: ${url}`); // Log API fetch
    try {
        const response = await FetchRestData(url) as T; // Type assertion added
        if (!response) {
            throw new Error(`Failed to fetch data: ${response}`);
        }

        RedisCache.set("url:" + url, JSON.stringify(response), ttl); // 20 minutes
        return response as T;
    } catch (error) {
        logger.error(`Error fetching data from ${url}:`, error); // Use logger for error
        throw error; // Rethrow the error for further handling
    }
}


