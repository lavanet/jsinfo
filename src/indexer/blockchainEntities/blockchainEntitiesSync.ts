// src/indexer/blockchainEntities/blockchainEntitiesSync.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ne } from "drizzle-orm";
import { DoInChunks } from "../../utils";
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
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
    blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>
) {
    console.log("SyncBlockchainEntities: Starting SyncBlockchainEntities at height", height);
    const startTime = Date.now();

    await UpdateStakeInformation(client, height, blockchainEntitiesProviders, blockchainEntitiesSpecs, blockchainEntitiesStakes)
    // await getLatestPlans(client, blockchainEntitiesPlans)

    await db.transaction(async (tx) => {
        // Insert all specs
        const arrSpecs = Array.from(blockchainEntitiesSpecs.values())
        console.log("SyncBlockchainEntities: Inserting", arrSpecs.length, "specs");
        await DoInChunks(JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrSpecs, async (arr: any) => {
            await tx.insert(JsinfoSchema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(blockchainEntitiesProviders.values())
        console.log("SyncBlockchainEntities: Processing", arrProviders.length, "providers");
        await DoInChunks(JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrProviders, async (arr: any) => {
            return arr.map(async (provider: any) => {
                return await tx.insert(JsinfoSchema.providers)
                    .values(provider)
                    .onConflictDoUpdate(
                        {
                            target: [JsinfoSchema.providers.address],
                            set: {
                                moniker: provider.moniker
                            },
                        }
                    );
            })
        })

        // Insert all stakes
        console.log("SyncBlockchainEntities: Inserting stakes");
        await Promise.all(Array.from(blockchainEntitiesStakes.values()).map(async (stakes) => {
            return stakes.map(async (stake) => {
                if (stake.specId == null || stake.specId == "") return;
                // console.log("SyncBlockchainEntities: Inserting stake for provider", stake.provider, "and specId", stake.specId);
                return await tx.insert(JsinfoSchema.providerStakes)
                    .values(stake)
                    .onConflictDoUpdate(
                        {
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
                        }
                    );
            })
        }))

        // Update old stakes
        console.log("SyncBlockchainEntities: Updating old stakes to inactive status");
        await tx.update(JsinfoSchema.providerStakes)
            .set({
                status: JsinfoSchema.LavaProviderStakeStatus.Inactive
            })
            .where(ne(JsinfoSchema.providerStakes.blockId, height))

        const endTime = Date.now();
        console.log("SyncBlockchainEntities: SyncBlockchainEntities completed in", (endTime - startTime) / 1000, "seconds with stakes");
    })
}