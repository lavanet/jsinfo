// src/query/handlers/lavapDualStackingDelegatorRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbInstance } from '../queryDb';
import { eq, lt, and, desc } from "drizzle-orm";
import { JSINFO_QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CUTOFF_DAYS } from '../queryConsts';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';

type RewardInput = {
    provider: string;
    chain_id: string;
    amount: {
        denom: string;
        amount: string;
    }[];
};

export const LavapDualStackingDelegatorRewardsOpts: RouteShorthandOptions = {
    schema: {
        body: {
            type: 'object',
            required: ['rewards'],
            properties: {
                rewards: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['provider', 'chain_id', 'amount'],
                        properties: {
                            provider: { type: 'string' },
                            chain_id: { type: 'string' },
                            amount: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    required: ['denom', 'amount'],
                                    properties: {
                                        denom: { type: 'string' },
                                        amount: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

function validateProvider(provider: string): string {
    if (!provider.startsWith('lava@')) {
        throw new Error(`Invalid provider: ${provider}`);
    }
    return provider;
}

export async function LavapDualStackingDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance();

    const body: any = request.body

    // Validate and parse request
    if (!body || !('rewards' in body)) {
        WriteErrorToFastifyReply(reply, 'Invalid request body or missing rewards property');
        return;
    }

    const rewards: RewardInput[] = body.rewards as RewardInput[];

    let provider: string = "";

    let addTimestamp = new Date();

    const insertData: JsinfoSchema.InsertDualStackingDelegatorRewards[] = rewards.flatMap(reward => {
        // Validate provider format
        provider = validateProvider(reward.provider);

        return reward.amount.map(a => ({
            timestamp: addTimestamp,
            provider: reward.provider,
            chainId: reward.chain_id,
            amount: parseInt(a.amount),
            denom: a.denom
        }));
    });

    // If insertData is empty, print raw data to console and return
    if (insertData.length === 0) {
        console.log(`[${new Date().toISOString()}] LavapDualStackingDelegatorRewardsHandler: Provider: ${provider}. Raw data:`, request.body);
        reply.code(200).send({ status: 'success', message: 'No data to process.' });
        return;
    }

    try {
        const db = await QueryGetJsinfoDbInstance();
        await db.transaction(async (tx) => {

            // Get the current hour
            const currentHour = new Date().getHours();

            // Check if the current hour is between 3 and 4 AM
            if (currentHour === 3) {
                // Delete entries older than JSINFO_QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CUTOFF_DAYS (30 days)
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - JSINFO_QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CUTOFF_DAYS);
                await tx.delete(JsinfoSchema.dualStackingDelegatorRewards).where(lt(JsinfoSchema.dualStackingDelegatorRewards.timestamp, cutoffDate));
            }

            // Iterate over each entry in insertData
            for (const data of insertData) {

                // Fetch the latest entry for the same provider and chainId
                let latestEntries = await tx.select().from(JsinfoSchema.dualStackingDelegatorRewards)
                    .where(and(
                        eq(JsinfoSchema.dualStackingDelegatorRewards.chainId, data.chainId),
                        eq(JsinfoSchema.dualStackingDelegatorRewards.provider, data.provider)
                    ))
                    .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp))
                    .offset(0)
                    .limit(1);

                let latestEntry = latestEntries ? latestEntries[0] : null;

                // Only insert new data if it's different from the latest entry
                if (!latestEntry || latestEntry.amount !== data.amount || latestEntry.denom !== data.denom) {
                    const result = await tx.insert(JsinfoSchema.dualStackingDelegatorRewards).values(data)
                        .returning({ chain: JsinfoSchema.dualStackingDelegatorRewards.chainId });

                    console.log(`[${new Date().toISOString()}] LavapDualStackingDelegatorRewardsHandler: Provider: ${data.provider}. Inserted 1 reward entry. chains: ${JSON.stringify(result)}`);
                }
            }
        });

        reply.code(200).send({ status: 'success', message: 'Rewards processed successfully.' });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] LavapDualStackingDelegatorRewardsHandler: Provider: ${provider}. Failed to process rewards:`, error);
        reply.code(500).send({ status: 'error', message: 'Failed to process rewards.' });
    }
}