// src/indexer/blockchainEntities/blockchainEntitiesGettersAndSetters.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';

export function GetOrSetProvider(
    dbProviders: Map<string, JsinfoSchema.Provider>,
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider> | null,
    address: string,
    moniker: string
): JsinfoSchema.Provider {
    if (blockchainEntitiesProviders != null) {
        let staticProvider = blockchainEntitiesProviders.get(address);
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
    blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec> | null,
    specS: string
): JsinfoSchema.Spec {
    if (blockchainEntitiesSpecs != null) {
        let staticSpec = blockchainEntitiesSpecs.get(specS);
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
    height: number) {
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
