import * as lavajs from '@lavanet/lavajs';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { ne } from "drizzle-orm";
import { DoInChunks } from "./utils";
import { StakeEntry } from '@lavanet/lavajs/dist/codegen/lavanet/lava/epochstorage/stake_entry';

export type LavaClient = Awaited<ReturnType<typeof lavajs.lavanet.ClientFactory.createRPCQueryClient>>

export function GetOrSetProvider(
    dbProviders: Map<string, schema.Provider>,
    static_dbProviders: Map<string, schema.Provider> | null,
    address: string,
    moniker: string
): schema.Provider {
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
    } as schema.Provider
    dbProviders.set(address, provider)
    return provider
}

export function GetOrSetSpec(
    dbSpecs: Map<string, schema.Spec>,
    static_dbSpecs: Map<string, schema.Spec> | null,
    specS: string
): schema.Spec {
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
    } as schema.Spec
    dbSpecs.set(specS, spec)
    return spec
}

export function SetTx(
    dbTxs: Map<string, schema.Tx>,
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
    } as schema.Tx
    dbTxs.set(txHash, dbTx)

    return
}

export function GetOrSetConsumer(
    dbConsumers: Map<string, schema.Consumer>,
    address: string
): schema.Consumer {
    let dbConsumer = dbConsumers.get(address);
    if (dbConsumer != undefined) {
        return dbConsumer
    }

    dbConsumer = {
        address: address
    } as schema.Consumer
    dbConsumers.set(address, dbConsumer)
    return dbConsumer
}

export function GetOrSetPlan(
    dbPlans: Map<string, schema.Plan>,
    static_dbPlans: Map<string, schema.Plan> | null,
    planId: string
): schema.Plan {
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
    } as schema.Plan
    dbPlans.set(planId, dbPlan)
    return dbPlan
}

function _doStake(
    height: number,
    dbProviders: Map<string, schema.Provider>,
    dbStakes: Map<string, schema.ProviderStake[]>,
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
    let stakeArr: schema.ProviderStake[] = dbStakes.get(providerStake.address)!

    // status
    const appliedHeight = providerStake.stakeAppliedBlock.toSigned().toInt()
    let status = schema.LavaProviderStakeStatus.Active
    if (isUnstaking) {
        status = schema.LavaProviderStakeStatus.Unstaking
    } else if (appliedHeight == -1) {
        status = schema.LavaProviderStakeStatus.Frozen
    }
    stakeArr.push({
        provider: providerStake.address,
        blockId: height,
        specId: providerStake.chain,
        geolocation: providerStake.geolocation.toNumber(),
        addons: addons,
        extensions: extensions,
        status: status,

        stake: parseInt(providerStake.stake.amount),
        appliedHeight: appliedHeight,
    } as schema.ProviderStake)
}

async function getLatestProvidersAndSpecsAndStakes(
    client: LavaClient,
    height: number,
    dbProviders: Map<string, schema.Provider>,
    dbSpecs: Map<string, schema.Spec>,
    dbStakes: Map<string, schema.ProviderStake[]>,
) {
    const lavaClient = client.lavanet.lava;
    dbStakes.clear()

    // regular stakes
    let specs = await lavaClient.spec.showAllChains()
    await Promise.all(specs.chainInfoList.map(async (spec) => {
        GetOrSetSpec(dbSpecs, null, spec.chainID)

        let providers = await lavaClient.pairing.providers({ chainID: spec.chainID, showFrozen: true })
        providers.stakeEntry.forEach((stake) => {
            _doStake(height, dbProviders, dbStakes, stake, false)
        })
    }))

    // unstaking stakes
    let unstaking = await lavaClient.epochstorage.stakeStorage({
        index: 'Unstake'
    })
    unstaking.stakeStorage.stakeEntries.forEach((stake) => {
        //
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
        _doStake(height, dbProviders, dbStakes, stake, true)
    })
}

async function getLatestPlans(client: LavaClient, dbPlans: Map<string, schema.Plan>) {
    const lavaClient = client.lavanet.lava;

    let plans = await lavaClient.plans.list()
    plans.plansInfo.forEach((plan) => {
        dbPlans.set(plan.index, {
            desc: plan.description,
            id: plan.index,
            price: parseInt(plan.price.amount),
        } as schema.Plan)
    })
}

export async function UpdateLatestBlockMeta(
    db: PostgresJsDatabase,
    client: LavaClient,
    height: number,
    withStakes: boolean,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>
) {
    await getLatestProvidersAndSpecsAndStakes(client, height, static_dbProviders, static_dbSpecs, static_dbStakes)
    await getLatestPlans(client, static_dbPlans)

    await db.transaction(async (tx) => {
        //
        // Insert all specs
        const arrSpecs = Array.from(static_dbSpecs.values())
        await DoInChunks(100, arrSpecs, async (arr: any) => {
            await tx.insert(schema.specs)
                .values(arr)
                .onConflictDoNothing();
        })

        // Find / create all providers
        const arrProviders = Array.from(static_dbProviders.values())
        await DoInChunks(100, arrProviders, async (arr: any) => {
            return arr.map(async (provider: any) => {
                return await tx.insert(schema.providers)
                    .values(provider)
                    .onConflictDoUpdate(
                        {
                            target: [schema.providers.address],
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
                return await tx.insert(schema.plans)
                    .values(arrPlans)
                    .onConflictDoUpdate({
                        target: [schema.plans.id],
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
                    return await tx.insert(schema.providerStakes)
                        .values(stake)
                        .onConflictDoUpdate(
                            {
                                target: [schema.providerStakes.provider, schema.providerStakes.specId],
                                set: {
                                    stake: stake.stake,
                                    appliedHeight: stake.appliedHeight,
                                    blockId: height,
                                    geolocation: stake.geolocation,
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
            await tx.update(schema.providerStakes)
                .set({
                    status: schema.LavaProviderStakeStatus.Inactive
                })
                .where(ne(schema.providerStakes.blockId, height))
        }
    })
}
