// src/indexer/blockchainEntities/blockchainEntitiesSync.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, ne } from "drizzle-orm";
import { IsMeaningfulText } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
import { LavaClient } from '@jsinfo/indexer/lavaTypes';
import { UpdateStakeInformation } from '@jsinfo/indexer/blockchainEntities/blockchainEntitiesStakeUpdater';
import { queryJsinfo } from '@jsinfo/utils/db';

export async function SyncBlockchainEntities(
    height: number,
    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>
) {
    const startTime = Date.now();

    await UpdateStakeInformation(height, blockchainEntitiesStakes)

    await queryJsinfo(async (db: PostgresJsDatabase) => {
        return await db.transaction(async (tx: PostgresJsDatabase) => {

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

            return { success: true };
        })
    }, "SyncBlockchainEntities")
}
