import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { keyValueStore } from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RpcEndpointCache } from '../classes/RpcEndpointCache';
import { logger } from '../../utils/utils';

async function saveToKeyValueStore(db: PostgresJsDatabase, key: string, value: string): Promise<void> {
    try {
        await db.insert(keyValueStore).values({ key, value })
            .onConflictDoUpdate({ target: keyValueStore.key, set: { value, updatedAt: new Date() } });
        logger.info(`Saved to key_value_store: ${key} = ${value}`);
    } catch (error) {
        logger.error(`Error saving to key_value_store: ${key}`, { error });
        throw error;
    }
}

async function saveStakersTotalCurrentUniqueUsers(db: PostgresJsDatabase): Promise<void> {
    const total = await RpcEndpointCache.GetTotalDelegatedAmount();
    await saveToKeyValueStore(db, 'stakers_total_current_unique_users', total.toString());
}

async function saveStakersTotalMonthlyUniqueUsers(db: PostgresJsDatabase): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const total = await RpcEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo);
    await saveToKeyValueStore(db, 'stakers_total_monthly_unique_users', total.toString());
}

async function saveRestakersTotalCurrentUniqueUsers(db: PostgresJsDatabase): Promise<void> {
    const total = await RpcEndpointCache.GetTotalDelegatedAmount(undefined, true);
    await saveToKeyValueStore(db, 'restakers_total_current_unique_users', total.toString());
}

async function saveRestakersTotalMonthlyUniqueUsers(db: PostgresJsDatabase): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const total = await RpcEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo, true);
    await saveToKeyValueStore(db, 'restakers_total_monthly_unique_users', total.toString());
}

export async function ProcessChainWalletApi(db: PostgresJsDatabase): Promise<void> {
    // const startTime = performance.now();
    try {
        await saveStakersTotalCurrentUniqueUsers(db);
        await saveStakersTotalMonthlyUniqueUsers(db);
        await saveRestakersTotalCurrentUniqueUsers(db);
        await saveRestakersTotalMonthlyUniqueUsers(db);

        // const endTime = performance.now();
        // logger.info(`ProcessChainWalletApi completed in ${endTime - startTime}ms`);
    } catch (error) {
        logger.error('Error in ProcessChainWalletApi', { error });
        throw error;
    }
}