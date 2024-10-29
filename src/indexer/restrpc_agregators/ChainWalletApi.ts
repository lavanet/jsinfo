// TODO: uncomment chain wallet api to when it is available

// import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
// import { keyValueStore } from '../../schemas/jsinfoSchema/jsinfoSchema';
// import { RpcEndpointCache } from '../classes/RpcEndpointCache';
// import { logger } from '../../utils/utils';

// async function saveToKeyValueStore(db: PostgresJsDatabase, key: string, value: string): Promise<void> {
//     try {
//         await db.insert(keyValueStore).values({ key, value })
//             .onConflictDoUpdate({ target: keyValueStore.key, set: { value, updatedAt: new Date() } });
//         logger.info(`Saved to key_value_store: ${key} = ${value}`);
//     } catch (error) {
//         logger.error(`Error saving to key_value_store: ${key}`, { error });
//         throw error;
//     }
// }

// async function saveStakersTotalCurrentUlavaAmount(db: PostgresJsDatabase): Promise<void> {
//     const total = await RpcEndpointCache.GetTotalDelegatedAmount(undefined, true);
//     await saveToKeyValueStore(db, 'stakers_total_current_ulava_amount', total.toString());
// }

// async function saveStakersTotalMonthlyUlavaAmount(db: PostgresJsDatabase): Promise<void> {
//     const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
//     const total = await RpcEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo, true);
//     await saveToKeyValueStore(db, 'stakers_total_monthly_ulava_amount', total.toString());
// }

// async function saveRestakersTotalCurrentUlavaAmount(db: PostgresJsDatabase): Promise<void> {
//     const total = await RpcEndpointCache.GetTotalDelegatedAmount();
//     await saveToKeyValueStore(db, 'restakers_total_current_ulava_amount', total.toString());
// }

// async function saveRestakersTotalMonthlyUlavaAmount(db: PostgresJsDatabase): Promise<void> {
//     const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
//     const total = await RpcEndpointCache.GetTotalDelegatedAmount(thirtyDaysAgo);
//     await saveToKeyValueStore(db, 'restakers_total_monthly_ulava_amount', total.toString());
// }

// // New functions using GetUniqueDelegatorCount
// async function saveStakersCurrentUniqueDelegators(db: PostgresJsDatabase): Promise<void> {
//     const count = await RpcEndpointCache.GetUniqueDelegatorCount(undefined, true);
//     await saveToKeyValueStore(db, 'stakers_current_unique_delegators', count.toString());
// }

// async function saveStakersMonthlyUniqueDelegators(db: PostgresJsDatabase): Promise<void> {
//     const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
//     const count = await RpcEndpointCache.GetUniqueDelegatorCount(thirtyDaysAgo, true);
//     await saveToKeyValueStore(db, 'stakers_monthly_unique_delegators', count.toString());
// }

// async function saveRestakersCurrentUniqueDelegators(db: PostgresJsDatabase): Promise<void> {
//     const count = await RpcEndpointCache.GetUniqueDelegatorCount();
//     await saveToKeyValueStore(db, 'restakers_current_unique_delegators', count.toString());
// }

// async function saveRestakersMonthlyUniqueDelegators(db: PostgresJsDatabase): Promise<void> {
//     const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
//     const count = await RpcEndpointCache.GetUniqueDelegatorCount(thirtyDaysAgo);
//     await saveToKeyValueStore(db, 'restakers_monthly_unique_delegators', count.toString());
// }

// export async function ProcessChainWalletApi(db: PostgresJsDatabase): Promise<void> {
//     try {
//         await saveStakersTotalCurrentUlavaAmount(db);
//         await saveStakersTotalMonthlyUlavaAmount(db);
//         await saveRestakersTotalCurrentUlavaAmount(db);
//         await saveRestakersTotalMonthlyUlavaAmount(db);

//         // New function calls
//         await saveStakersCurrentUniqueDelegators(db);
//         await saveStakersMonthlyUniqueDelegators(db);
//         await saveRestakersCurrentUniqueDelegators(db);
//         await saveRestakersMonthlyUniqueDelegators(db);

//     } catch (error) {
//         logger.error('Error in ProcessChainWalletApi', { error });
//         throw error;
//     }
// }
