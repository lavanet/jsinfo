// src/indexer/blockchainEntities/blockchainEntitiesSync.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, ne } from "drizzle-orm";
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
import { UpdateStakeInformation } from '@jsinfo/indexer/blockchainEntities/blockchainEntitiesStakeUpdater';
import { queryJsinfo } from '@jsinfo/utils/db';
import { GetLatestBlock } from '@jsinfo/query/utils/getLatestBlock';
import { StringifyWithBigInt } from '@jsinfo/utils/bigint';

let lastExecutedHeight: number | null = null; // Track the last executed height
let runningPromise: Promise<void> | null = null; // Track the running promise

export async function SyncBlockchainEntities() {
    const { latestHeight } = await GetLatestBlock();

    // Check if the function is already running or if the latestHeight is the same as the last executed height
    if (runningPromise) {
        return await runningPromise;
    }

    if (latestHeight <= (lastExecutedHeight ?? 0)) {
        return;
    }

    runningPromise = (async () => {
        const startTime = Date.now();
        console.log(`SyncBlockchainEntities: Latest block height is ${latestHeight}`);

        let dbStakes = new Map<string, JsinfoSchema.InsertProviderStake[]>();
        await UpdateStakeInformation(latestHeight, dbStakes);
        // console.log(`SyncBlockchainEntities: Retrieved ${dbStakes.size} stake entries from UpdateStakeInformation`);

        await queryJsinfo(async (db: PostgresJsDatabase) => {
            return await db.transaction(async (tx: PostgresJsDatabase) => {

                const uniqueStakesMap = new Map<string, any>();

                for (const stakes of dbStakes.values()) {
                    stakes.forEach(stake => {
                        if (!IsMeaningfulText(stake.provider) || !IsMeaningfulText(stake.specId)) {
                            // console.log(`Skipping stake due to invalid provider or specId: provider=${stake.provider}, specId=${stake.specId}`);
                            return;
                        }

                        const key = `${stake.provider}-${stake.specId}`;
                        // console.log(`Processing stake: key=${key}, stake=${stake.stake}`);

                        if (uniqueStakesMap.has(key)) {
                            const existingStake = uniqueStakesMap.get(key);
                            if (stake.stake && existingStake.stake && stake.stake > existingStake.stake) {
                                console.log(`Updating stake for key=${key} from ${existingStake.stake} to ${stake.stake}`);
                                uniqueStakesMap.set(key, stake);
                            } else {
                                // console.log(`Existing stake for key=${key} is greater or equal, not updating.`);
                            }
                        } else {
                            uniqueStakesMap.set(key, stake);
                            console.log(`Adding new stake for key=${key}: ${stake}`);
                        }
                    });
                }

                const uniqueStakesArray = Array.from(uniqueStakesMap.values());
                // console.log(`SyncBlockchainEntities: Unique stakes to insert/update: ${uniqueStakesArray.length}`);

                await Promise.all(uniqueStakesArray.map(async (stake) => {
                    try {
                        // console.log(`Inserting/updating stake: ${StringifyWithBigInt(stake)}`);
                        await tx.insert(JsinfoSchema.providerStakes)
                            .values(stake)
                            .onConflictDoUpdate({
                                target: [JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId],
                                set: {
                                    stake: stake.stake,
                                    appliedHeight: stake.appliedHeight,
                                    blockId: latestHeight,
                                    geolocation: stake.geolocation,
                                    addons: stake.addons,
                                    extensions: stake.extensions,
                                    status: stake.status,
                                    delegateCommission: stake.delegateCommission,
                                    delegateLimit: stake.delegateLimit,
                                    delegateTotal: stake.delegateTotal,
                                },
                            });
                        // console.log(`Successfully inserted/updated stake for provider=${stake.provider}, specId=${stake.specId}`);
                    } catch (error) {
                        console.error(`Error inserting/updating stake for provider=${stake.provider}, specId=${stake.specId}:`, error);
                    }
                }));

                // Update old stakes
                console.log("SyncBlockchainEntities: Updating old stakes to inactive status");
                await tx.update(JsinfoSchema.providerStakes)
                    .set({
                        status: JsinfoSchema.LavaProviderStakeStatus.Inactive
                    })
                    .where(
                        and(
                            eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active),
                            ne(JsinfoSchema.providerStakes.blockId, latestHeight)
                        ));

                const endTime = Date.now();
                logger.info("SyncBlockchainEntities: SyncBlockchainEntities completed in", { "time": (endTime - startTime) / 1000 });

                return { success: true };
            });
        }, `SyncBlockchainEntities:${latestHeight}`);

        lastExecutedHeight = latestHeight; // Update the last executed height
        runningPromise = null; // Reset the running promise
    })();

    return await runningPromise; // Return the promise
}
