import { keyValueStore } from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/RpcPeriodicEndpointCache';
import { logger } from '@jsinfo/utils/logger';
import { queryJsinfo } from '@jsinfo/utils/db';

async function saveToKeyValueStore(key: string, value: string): Promise<void> {
    try {
        await queryJsinfo(
            async (db) => db.insert(keyValueStore).values({ key, value })
                .onConflictDoUpdate({ target: keyValueStore.key, set: { value, updatedAt: new Date() } }),
            `saveToKeyValueStore:${key}:${value}`
        );
        logger.info(`Saved to key_value_store: ${key} = ${value}`);
    } catch (error) {
        logger.error(`Error saving to key_value_store: ${key}`, { error });
        throw error;
    }
}

async function saveStakersTotalCurrentUlavaAmount(): Promise<void> {
    const total = await RpcPeriodicEndpointCache.GetTotalDelegatedAmount(undefined, true);
    await saveToKeyValueStore('stakers_total_current_ulava_amount', total.toString());
}

async function saveStakersTotalMonthlyUlavaAmount(): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const total = await RpcPeriodicEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo, true);
    await saveToKeyValueStore('stakers_total_monthly_ulava_amount', total.toString());
}

async function saveRestakersTotalCurrentUlavaAmount(): Promise<void> {
    const total = await RpcPeriodicEndpointCache.GetTotalDelegatedAmount();
    await saveToKeyValueStore('restakers_total_current_ulava_amount', total.toString());
}

async function saveRestakersTotalMonthlyUlavaAmount(): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const total = await RpcPeriodicEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo);
    await saveToKeyValueStore('restakers_total_monthly_ulava_amount', total.toString());
}

// New functions using GetUniqueDelegatorCount
async function saveStakersCurrentUniqueDelegators(): Promise<void> {
    const count = await RpcPeriodicEndpointCache.GetUniqueDelegatorCount(undefined, true);
    await saveToKeyValueStore('stakers_current_unique_delegators', count.toString());
}

async function saveStakersMonthlyUniqueDelegators(): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const count = await RpcPeriodicEndpointCache.GetUniqueDelegatorCount(thirtyDaysAgo, true);
    await saveToKeyValueStore('stakers_monthly_unique_delegators', count.toString());
}

async function saveRestakersCurrentUniqueDelegators(): Promise<void> {
    const count = await RpcPeriodicEndpointCache.GetUniqueDelegatorCount();
    await saveToKeyValueStore('restakers_current_unique_delegators', count.toString());
}

async function saveRestakersMonthlyUniqueDelegators(): Promise<void> {
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const count = await RpcPeriodicEndpointCache.GetUniqueDelegatorCount(thirtyDaysAgo);
    await saveToKeyValueStore('restakers_monthly_unique_delegators', count.toString());
}

export async function ProcessChainWalletApi(): Promise<void> {
    try {
        await saveStakersTotalCurrentUlavaAmount();
        await saveStakersTotalMonthlyUlavaAmount();
        await saveRestakersTotalCurrentUlavaAmount();
        await saveRestakersTotalMonthlyUlavaAmount();

        await saveStakersCurrentUniqueDelegators();
        await saveStakersMonthlyUniqueDelegators();
        await saveRestakersCurrentUniqueDelegators();
        await saveRestakersMonthlyUniqueDelegators();

    } catch (error) {
        logger.error('Error in ProcessChainWalletApi', { error });
        throw error;
    }
}
