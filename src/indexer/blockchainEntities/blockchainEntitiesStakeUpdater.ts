// src/indexer/blockchainEntities/blockchainEntitiesStakeUpdater.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { StakeEntry } from '@lavanet/lavajs/dist/codegen/lavanet/lava/epochstorage/stake_entry';
import { AppendUniqueItems, ToSignedBigIntOrMinusOne, ToSignedIntOrMinusOne } from '../utils/indexerUtils';
import { logger } from '@jsinfo/utils/logger';
import { queryRpc } from '../utils/lavajsRpc';
import { SpecAndConsumerService } from '@jsinfo/redis/resources/global/SpecAndConsumerResource';
import { LavaClient } from '../lavaTypes';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

function processStakeEntry(
    height: number,
    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
    providerStake: StakeEntry,
) {
    // Log the start of processing for the provider stake

    // init if needed
    if (dbStakes.get(providerStake.address) == undefined) {
        dbStakes.set(providerStake.address, []);
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


    // Explanation 16/01/25:
    // In provider who is not active is either Frozen of Jailed
    // Frozen : stakeAppliedBlock is MAX_INT (parsed here as -1)
    // Jailed : jailedEndTime is bigger then now

    const appliedHeight = ToSignedIntOrMinusOne(providerStake.stakeAppliedBlock)

    let status = JsinfoSchema.LavaProviderStakeStatus.Active
    if (appliedHeight == -1) {
        status = JsinfoSchema.LavaProviderStakeStatus.Frozen
    }

    if (providerStake.jailEndTime && IsMeaningfulText(providerStake.jailEndTime + "")) {
        const jailEndTime = Number(providerStake.jailEndTime);
        const now = Math.floor(Date.now() / 1000);
        const isJailed = jailEndTime > now;
        if (isJailed) {
            status = JsinfoSchema.LavaProviderStakeStatus.Jailed
        }
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
        delegateLimit: 0n,
        delegateTotal: ToSignedBigIntOrMinusOne(providerStake.delegateTotal.amount),
        delegateCommission: ToSignedBigIntOrMinusOne(providerStake.delegateCommission),
        appliedHeight: ToSignedIntOrMinusOne(appliedHeight),
    }

    stakeArr.push(data)
}

export async function UpdateStakeInformation(
    height: number,
    dbStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) {
    const startTime = Date.now();
    try {
        logger.info(`UpdateStakeInformation: started`);

        dbStakes.clear();

        const allSpecs = await SpecAndConsumerService.GetAllSpecs();
        for (const spec of allSpecs) {
            const providers = await queryRpc(
                async (_, __, lavaClient: LavaClient) => lavaClient.lavanet.lava.pairing.providers({ chainID: spec, showFrozen: true }),
                'pairing.getProviders'
            );
            providers.stakeEntry.forEach(stake => {
                processStakeEntry(height, dbStakes, stake);
            });
        }

        const processRegularTime = Date.now();
        logger.info(`UpdateStakeInformation: processRegularStakes completed, elapsed time: ${processRegularTime - startTime}ms`);

    } catch (error) {
        const errorTime = Date.now();
        logger.error(`UpdateStakeInformation: An error occurred, elapsed time: ${errorTime - startTime}ms, error: ${error}`);
        throw error;
    } finally {
        const endTime = Date.now();
        logger.info(`UpdateStakeInformation: ended, total elapsed time: ${endTime - startTime}ms`);
    }
}
