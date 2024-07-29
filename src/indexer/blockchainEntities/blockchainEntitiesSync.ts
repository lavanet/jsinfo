// src/indexer/blockchainEntities/blockchainEntitiesSync.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ne } from "drizzle-orm";
import { DoInChunks } from "../../utils";
import { JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE } from '../indexerConsts';
import { ToSignedIntOrMinusOne } from '../indexerUtils';
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
    withStakes: boolean,
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
    blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>
) {
    await UpdateStakeInformation(client, height, blockchainEntitiesProviders, blockchainEntitiesSpecs, blockchainEntitiesStakes)
    // await getLatestPlans(client, blockchainEntitiesPlans)

    await db.transaction(async (tx) => {
        // Insert all specs
        const arrSpecs = Array.from(blockchainEntitiesSpecs.values())
        await DoInChunks(JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrSpecs, async (arr: any) => {
            await tx.insert(JsinfoSchema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(blockchainEntitiesProviders.values())
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

        // // Find our create all plans
        // const arrPlans = Array.from(blockchainEntitiesPlans.values())
        // if (arrPlans.length > 0) {
        //     await Promise.all(arrPlans.map(async (plan: any) => {
        //         return await tx.insert(JsinfoSchema.plans)
        //             .values(arrPlans)
        //             .onConflictDoUpdate({
        //                 target: [JsinfoSchema.plans.id],
        //                 set: {
        //                     desc: plan.desc,
        //                     price: plan.price,
        //                 }
        //             });
        //     }))
        // }

        if (!withStakes) return;

        // Insert all stakes
        await Promise.all(Array.from(blockchainEntitiesStakes.values()).map(async (stakes) => {
            return stakes.map(async (stake) => {
                if (stake.specId == null || stake.specId == "") return;
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
        await tx.update(JsinfoSchema.providerStakes)
            .set({
                status: JsinfoSchema.LavaProviderStakeStatus.Inactive
            })
            .where(ne(JsinfoSchema.providerStakes.blockId, height))
    })
}
