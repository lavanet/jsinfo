// src/indexer/blockchainEntities/blockchainEntitiesStakeUpdater.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { StakeEntry } from '@lavanet/lavajs/dist/codegen/lavanet/lava/epochstorage/stake_entry';
import { AppendUniqueItems, ToSignedBigIntOrMinusOne, ToSignedIntOrMinusOne } from '../utils/indexerUtils';
import { LavaClient } from '../types';
import { logger } from '../../utils/logger';

/*
providers with stake {
stakeEntry: [
{
stake: {
denom: "ulava",
amount: "85714285714",
},
address: "lava@1ttcekv34zhw79h3j88zw7zpg9ggxpp5muwckgn",
stakeAppliedBlock: 298353n,
endpoints: [
{
iPPORT: "provider2-cos4.providers-us.lava-cybertron.xyz:443",
geolocation: 1,
addons: [],
apiInterfaces: [ "tendermintrpc", "rest", "grpc" ],
extensions: [],
}
],
geolocation: 1,
chain: "COS4",
moniker: "",
delegateTotal: {
denom: "ulava",
amount: "0",
},
delegateLimit: {
denom: "ulava",
amount: "0",
},
delegateCommission: 100n,
lastChange: 0n,
blockReport: {
epoch: 1785960n,
latestBlock: 7005057n,
},
vault: "lava@1ttcekv34zhw79h3j88zw7zpg9ggxpp5muwckgn",
description: {
moniker: "",
identity: "",
website: "",
securityContact: "",
details: "",
},
jails: 0n,
jailEndTime: 0n,
}, {
stake: {
denom: "ulava",
amount: "423076923077",
},
address: "lava@1y6vnu44t284spmlu8v5d0k82axmdqkc6dwg3fl",
stakeAppliedBlock: 298351n,
endpoints: [
{
iPPORT: "provider2-cos4.providers-eu.lava-cybertron.xyz:443",
geolocation: 2,
addons: [],
apiInterfaces: [ "tendermintrpc", "rest", "grpc" ],
extensions: [],
}
],
geolocation: 2,
chain: "COS4",
moniker: "",
delegateTotal: {
denom: "ulava",
amount: "0",
},
delegateLimit: {
denom: "ulava",
amount: "0",
},
delegateCommission: 100n,
lastChange: 0n,
blockReport: {
epoch: 1633800n,
latestBlock: 6737769n,
},
vault: "lava@1y6vnu44t284spmlu8v5d0k82axmdqkc6dwg3fl",
description: {
moniker: "",
identity: "",
website: "",
securityContact: "",
details: "",
},
jails: 0n,
jailEndTime: 0n,
}
],
}
*/
// delegate commision = provider takes fees from the rewards . got 1000 lava , his stake 100 , and he get 900 from other providers
// provider does first dip of 100 stake - this only in the provider

// Stake = providerStake.stake.amount (tooltip self stake)
// Delegation limit =       delegateLimit: {
//         denom: "ulava",
//             amount: "0",
//   },
// Delegations =
// Effective Stake =

// all of these under the provider and then on the main page with total

// new table

// min(delegate total, delegate limit)
// if delegate limit > delegate total : then : total stake = stake + delegate total
// if delegate limit < delegate total : then : total stake = stake + delegate limit

// Delegations : - 4 columns of stake
// In provider rename = rename Stakes to Attributes
// In spec page call Stakes - Relays

// self stake (provider self delegation) - how much the provider staked by himself
// stake: parseInt(providerStake.stake.amount),

function processStakeEntry(
    height: number,
    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
    providerStake: StakeEntry,
    isUnstaking: boolean,
) {

    // init if needed
    if (dbStakes.get(providerStake.address) == undefined) {
        dbStakes.set(providerStake.address, [])
    }

    // addons
    let addons: string[] = [];
    let extensions: string[] = [];
    providerStake.endpoints.forEach((endPoint: { addons: string[]; extensions: string[]; }) => {
        addons = AppendUniqueItems(addons, endPoint.addons);
        extensions = AppendUniqueItems(extensions, endPoint.extensions);
    });

    let addonsStr = addons.join(',');
    let extensionsStr = extensions.join(',');

    let stakeArr: JsinfoSchema.InsertProviderStake[] = dbStakes.get(providerStake.address)!


    // status
    const appliedHeight = ToSignedIntOrMinusOne(providerStake.stakeAppliedBlock)
    let status = JsinfoSchema.LavaProviderStakeStatus.Active
    if (isUnstaking) {
        status = JsinfoSchema.LavaProviderStakeStatus.Unstaking
    } else if (appliedHeight == -1) {
        status = JsinfoSchema.LavaProviderStakeStatus.Frozen
    }

    let data: JsinfoSchema.InsertProviderStake = {
        provider: providerStake.address,
        blockId: height,
        specId: providerStake.chain,
        geolocation: ToSignedIntOrMinusOne(providerStake.geolocation),
        addons: addonsStr,
        extensions: extensionsStr,
        status: status,
        stake: ToSignedBigIntOrMinusOne(providerStake.stake.amount),
        delegateLimit: ToSignedBigIntOrMinusOne(providerStake.delegateLimit.amount),
        delegateTotal: ToSignedBigIntOrMinusOne(providerStake.delegateTotal.amount),
        delegateCommission: ToSignedBigIntOrMinusOne(providerStake.delegateCommission),
        appliedHeight: ToSignedIntOrMinusOne(appliedHeight),
    }

    stakeArr.push(data)
}

export async function UpdateStakeInformation(
    client: LavaClient,
    height: number,
    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) {
    const startTime = Date.now();
    try {
        logger.info(`UpdateStakeInformation: started`);

        const lavaClient = client.lavanet.lava;
        dbStakes.clear();

        await processRegularStakes(lavaClient, height, dbStakes);
        const processRegularTime = Date.now();
        logger.info(`UpdateStakeInformation: processRegularStakes completed, elapsed time: ${processRegularTime - startTime}ms`);

        await processUnstakingStakes(lavaClient, height, dbStakes);
        const processUnstakingTime = Date.now();
        logger.info(`UpdateStakeInformation: processUnstakingStakes completed, elapsed time: ${processUnstakingTime - processRegularTime}ms`);
    } catch (error) {
        const errorTime = Date.now();
        logger.error(`UpdateStakeInformation: An error occurred, elapsed time: ${errorTime - startTime}ms, error: ${error}`);
        throw error;
    } finally {
        const endTime = Date.now();
        logger.info(`UpdateStakeInformation: ended, total elapsed time: ${endTime - startTime}ms`);
    }
}

async function processRegularStakes(
    lavaClient: any,
    height: number,
    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) {
    let specs = await lavaClient.spec.showAllChains();
    await Promise.all(specs.chainInfoList.map(async (spec) => {
        let providers = await lavaClient.pairing.providers({ chainID: spec.chainID, showFrozen: true });
        providers.stakeEntry.forEach((stake) => {
            processStakeEntry(height, dbStakes, stake, false);
        });
    }));
}

async function processUnstakingStakes(
    lavaClient: any,
    height: number,

    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) {
    let unstaking;
    try {
        unstaking = await lavaClient.epochstorage.stakeStorage({
            index: 'Unstake'
        });
    } catch (error) {
        if ((error + "").includes('rpc error: code = InvalidArgument desc = not found: invalid request')) {
            logger.info('The unstake list is empty.');
            return;
        } else {
            throw error;
        }
    }

    unstaking.stakeStorage.stakeEntries.forEach((stake) => {
        if (dbStakes.get(stake.address) != undefined) {
            dbStakes.get(stake.address)!.forEach((dbStake) => {
                if (dbStake.specId == stake.chain) {
                    return;
                }
            });
        }
        processStakeEntry(height, dbStakes, stake, true);
    });
}