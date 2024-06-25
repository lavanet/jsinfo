import * as lavajs from '@lavanet/lavajs';
import * as JsinfoSchema from '../schemas/jsinfoSchema';

import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { ne } from "drizzle-orm";
import { DoInChunks } from "../utils";
import { StakeEntry } from '@lavanet/lavajs/dist/codegen/lavanet/lava/epochstorage/stake_entry';
import { JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE } from './indexerConsts';
import { ToSignedIntOrMinusOne } from './indexerUtils';

export type LavaClient = Awaited<ReturnType<typeof lavajs.lavanet.ClientFactory.createRPCQueryClient>>

export function GetOrSetProvider(
    dbProviders: Map<string, JsinfoSchema.Provider>,
    static_dbProviders: Map<string, JsinfoSchema.Provider> | null,
    address: string,
    moniker: string
): JsinfoSchema.Provider {
    if (static_dbProviders != null) {
        let staticProvider = static_dbProviders.get(address);
        if (staticProvider != undefined) {
            return staticProvider
        }
    }

    let provider = dbProviders.get(address);
    if ((provider != undefined) && ((provider.moniker != '') || ((provider.moniker == '') && (moniker == '')))) {
        return provider
    }

    provider = {
        address: address,
        moniker: moniker,
    } as JsinfoSchema.Provider
    dbProviders.set(address, provider)
    return provider
}

export function GetOrSetSpec(
    dbSpecs: Map<string, JsinfoSchema.Spec>,
    static_dbSpecs: Map<string, JsinfoSchema.Spec> | null,
    specS: string
): JsinfoSchema.Spec {
    if (static_dbSpecs != null) {
        let staticSpec = static_dbSpecs.get(specS);
        if (staticSpec != undefined) {
            return staticSpec
        }
    }

    let spec = dbSpecs.get(specS);
    if (spec != undefined) {
        return spec
    }

    spec = {
        id: specS
    } as JsinfoSchema.Spec
    dbSpecs.set(specS, spec)
    return spec
}

export function SetTx(
    dbTxs: Map<string, JsinfoSchema.Tx>,
    txHash: string | null,
    height: number,
) {
    if (txHash == null) {
        return
    }
    let dbTx = dbTxs.get(txHash);
    if (dbTx != undefined) {
        return
    }

    dbTx = {
        hash: txHash,
        blockId: height,
    } as JsinfoSchema.Tx
    dbTxs.set(txHash, dbTx)

    return
}

export function GetOrSetConsumer(
    dbConsumers: Map<string, JsinfoSchema.Consumer>,
    address: string
): JsinfoSchema.Consumer {
    let dbConsumer = dbConsumers.get(address);
    if (dbConsumer != undefined) {
        return dbConsumer
    }

    dbConsumer = {
        address: address
    } as JsinfoSchema.Consumer
    dbConsumers.set(address, dbConsumer)
    return dbConsumer
}

export function GetOrSetPlan(
    dbPlans: Map<string, JsinfoSchema.Plan>,
    static_dbPlans: Map<string, JsinfoSchema.Plan> | null,
    planId: string
): JsinfoSchema.Plan {
    if (static_dbPlans != null) {
        let staticPlan = static_dbPlans.get(planId);
        if (staticPlan != undefined) {
            return staticPlan
        }
    }

    let dbPlan = dbPlans.get(planId);
    if (dbPlan != undefined) {
        return dbPlan
    }

    dbPlan = {
        id: planId
    } as JsinfoSchema.Plan
    dbPlans.set(planId, dbPlan)
    return dbPlan
}

function processStakeEntry(
    height: number,
    dbProviders: Map<string, JsinfoSchema.Provider>,
    dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
    providerStake: StakeEntry,
    isUnstaking: boolean,
) {
    GetOrSetProvider(dbProviders, null, providerStake.address, providerStake.moniker)

    // init if needed
    if (dbStakes.get(providerStake.address) == undefined) {
        dbStakes.set(providerStake.address, [])
    }

    // addons
    let addons = ''
    let extensions = ''
    providerStake.endpoints.forEach((endPoint: { addons: string[]; extensions: string[]; }) => {
        addons += endPoint.addons.join(',')
        extensions += endPoint.extensions.join(',')
    })
    let stakeArr: JsinfoSchema.ProviderStake[] = dbStakes.get(providerStake.address)!

    // status
    const appliedHeight = ToSignedIntOrMinusOne(providerStake.stakeAppliedBlock)
    let status = JsinfoSchema.LavaProviderStakeStatus.Active
    if (isUnstaking) {
        status = JsinfoSchema.LavaProviderStakeStatus.Unstaking
    } else if (appliedHeight == -1) {
        status = JsinfoSchema.LavaProviderStakeStatus.Frozen
    }
    stakeArr.push({
        provider: providerStake.address,
        blockId: height,
        specId: providerStake.chain,
        geolocation: ToSignedIntOrMinusOne(providerStake.geolocation),
        addons: addons,
        extensions: extensions,
        status: status,

        stake: parseInt(providerStake.stake.amount),
        appliedHeight: appliedHeight,
    } as JsinfoSchema.ProviderStake)
}

async function getLatestProvidersAndSpecsAndStakes(
    client: LavaClient,
    height: number,
    dbProviders: Map<string, JsinfoSchema.Provider>,
    dbSpecs: Map<string, JsinfoSchema.Spec>,
    dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) {
    try {
        const lavaClient = client.lavanet.lava;
        dbStakes.clear()

        // regular stakes
        let specs = await lavaClient.spec.showAllChains()
        await Promise.all(specs.chainInfoList.map(async (spec) => {
            GetOrSetSpec(dbSpecs, null, spec.chainID)

            let providers = await lavaClient.pairing.providers({ chainID: spec.chainID, showFrozen: true })
            providers.stakeEntry.forEach((stake) => {
                processStakeEntry(height, dbProviders, dbStakes, stake, false)
            })
        }))

        let unstaking;
        try {
            // unstaking stakes
            unstaking = await lavaClient.epochstorage.stakeStorage({
                index: 'Unstake'
            });
        } catch (error) {
            // checked with the consensus team - if the unstake list is empty we get this error - happens on mainnet
            if ((error + "").includes('rpc error: code = InvalidArgument desc = not found: invalid request')) {
                console.log('The unstake list is empty.');
                return; // exit the function if the unstake list is empty
            } else {
                throw error; // re-throw the error if it's not the one we're expecting
            }
        }

        unstaking.stakeStorage.stakeEntries.forEach((stake) => {
            // Only add if no regular stake exists
            // if regular stake exists
            //      it means the provider restaked without waiting for unstaking period
            if (dbStakes.get(stake.address) != undefined) {
                dbStakes.get(stake.address)!.forEach((dbStake) => {
                    if (dbStake.specId == stake.chain) {
                        return
                    }
                })
            }
            processStakeEntry(height, dbProviders, dbStakes, stake, true)
        })
    } catch (error) {
        console.error(`An error occurred: ${error}`);
        throw error;
    }
}

async function getLatestPlans(client: LavaClient, dbPlans: Map<string, JsinfoSchema.Plan>) {
    try {
        const lavaClient = client.lavanet.lava;

        let plans = await lavaClient.plans.list()
        plans.plansInfo.forEach((plan) => {
            dbPlans.set(plan.index, {
                desc: plan.description,
                id: plan.index,
                price: parseInt(plan.price.amount),
            } as JsinfoSchema.Plan)
        })
    } catch (error) {
        console.error(`An error occurred: ${error}`);
        throw error;
    }
}

export async function UpdateLatestBlockMeta(
    db: PostgresJsDatabase,
    client: LavaClient,
    height: number,
    withStakes: boolean,
    static_dbProviders: Map<string, JsinfoSchema.Provider>,
    static_dbSpecs: Map<string, JsinfoSchema.Spec>,
    static_dbPlans: Map<string, JsinfoSchema.Plan>,
    static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>
) {
    await getLatestProvidersAndSpecsAndStakes(client, height, static_dbProviders, static_dbSpecs, static_dbStakes)
    await getLatestPlans(client, static_dbPlans)

    await db.transaction(async (tx) => {
        //
        // Insert all specs
        const arrSpecs = Array.from(static_dbSpecs.values())
        await DoInChunks(JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE, arrSpecs, async (arr: any) => {
            await tx.insert(JsinfoSchema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(static_dbProviders.values())
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

        //
        // Find our create all plans
        const arrPlans = Array.from(static_dbPlans.values())
        if (arrPlans.length > 0) {
            await Promise.all(arrPlans.map(async (plan: any) => {
                return await tx.insert(JsinfoSchema.plans)
                    .values(arrPlans)
                    .onConflictDoUpdate({
                        target: [JsinfoSchema.plans.id],
                        set: {
                            desc: plan.desc,
                            price: plan.price,
                        }
                    });
            }))
        }

        if (withStakes) {
            // Insert all stakes
            await Promise.all(Array.from(static_dbStakes.values()).map(async (stakes) => {
                return stakes.map(async (stake) => {
                    if (stake.specId == null || stake.specId == "") return;
                    return await tx.insert(JsinfoSchema.providerStakes)
                        .values(stake)
                        .onConflictDoUpdate(
                            {
                                target: [JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId],
                                set: {
                                    stake: stake.stake,
                                    appliedHeight: ToSignedIntOrMinusOne(stake.appliedHeight),
                                    blockId: height,
                                    geolocation: ToSignedIntOrMinusOne(stake.geolocation),
                                    addons: stake.addons,
                                    extensions: stake.extensions,
                                    status: stake.status,
                                },
                            }
                        );
                })
            }))
            // 
            // Update old stakes
            await tx.update(JsinfoSchema.providerStakes)
                .set({
                    status: JsinfoSchema.LavaProviderStakeStatus.Inactive
                })
                .where(ne(JsinfoSchema.providerStakes.blockId, height))
        }
    })
}
