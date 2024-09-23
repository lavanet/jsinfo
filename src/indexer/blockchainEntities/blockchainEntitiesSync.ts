// src/indexer/blockchainEntities/blockchainEntitiesSync.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, ne } from "drizzle-orm";
import { DoInChunks, IsMeaningfulText, logger } from "../../utils/utils";
import { JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE } from '../indexerConsts';
import { LavaClient } from '../types';
import { UpdateStakeInformation } from './blockchainEntitiesStakeUpdater';

// async function getLatestPlans(client: LavaClient, dbPlans: Map<string, JsinfoSchema.Plan>) {
//     try {
//         const lavaClient = client.lavanet.lava;

//         let plans = await lavaClient.plans.list()
//         plans.plansInfo.forEach((plan) => {
//             dbPlans.set(plan.index, {
//                 desc: plan.description,
//                 id: plan.index,
//                 price: parseInt(plan.price.amount),
//                 plan.terms.map((term) => {
//             } as JsinfoSchema.Plan)
//         })
//     } catch (error) {
//         logger.error(`An error occurred: ${error}`);
//         throw error;
//     }
// }

export async function SyncBlockchainEntities(
    db: PostgresJsDatabase,
    client: LavaClient,
    height: number,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>
) {
    // console.log("SyncBlockchainEntities: Starting SyncBlockchainEntities at height", height);
    const startTime = Date.now();

    await UpdateStakeInformation(client, height, blockchainEntitiesStakes)
    // await getLatestPlans(client, blockchainEntitiesPlans)

    await db.transaction(async (tx) => {
        // Insert all specs
        const arrSpecs = Array.from(blockchainEntitiesSpecs.values())
        // console.log("SyncBlockchainEntities: Inserting", arrSpecs.length, "specs");
        await DoInChunks(JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrSpecs, async (arr: any) => {
            await tx.insert(JsinfoSchema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        const uniqueStakesMap = new Map<string, any>();

        for (const stakes of blockchainEntitiesStakes.values()) {
            stakes.forEach(stake => {
                if (!IsMeaningfulText(stake.provider) || !IsMeaningfulText(stake.specId)) return;

                const key = `${stake.provider}-${stake.specId}`;

                if (uniqueStakesMap.has(key)) {
                    const existingStake = uniqueStakesMap.get(key);
                    if (stake.stake && existingStake.stake && stake.stake > existingStake.stake) {
                        uniqueStakesMap.set(key, stake);
                    }
                } else {
                    uniqueStakesMap.set(key, stake);
                }
            });
        }

        const uniqueStakesArray = Array.from(uniqueStakesMap.values());

        await Promise.all(uniqueStakesArray.map(async (stake) => {
            return await tx.insert(JsinfoSchema.providerStakes)
                .values(stake)
                .onConflictDoUpdate({
                    target: [JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId],
                    set: {
                        stake: stake.stake,
                        appliedHeight: stake.appliedHeight,
                        blockId: height,
                        geolocation: stake.geolocation,
                        addons: stake.addons,
                        extensions: stake.extensions,
                        status: stake.status,
                        delegateCommission: stake.delegateCommission,
                        delegateLimit: stake.delegateLimit,
                        delegateTotal: stake.delegateTotal,
                    },
                });
        }));

        // Update old stakes
        // console.log("SyncBlockchainEntities: Updating old stakes to inactive status");
        await tx.update(JsinfoSchema.providerStakes)
            .set({
                status: JsinfoSchema.LavaProviderStakeStatus.Inactive
            })
            .where(
                and(
                    eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active),
                    ne(JsinfoSchema.providerStakes.blockId, height)
                ));

        const endTime = Date.now();
        logger.info("SyncBlockchainEntities: SyncBlockchainEntities completed in", { "time": (endTime - startTime) / 1000 });
    })
}
