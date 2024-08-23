// src/query/handlers/indexStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { desc } from "drizzle-orm";
import { MinBigInt } from '../../../utils/utils';

export const IndexStakesHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    stakeSum: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function IndexStakesHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    // Get total provider stake
    let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).orderBy(desc(JsinfoSchema.providerStakes.stake));
    let stakeSum = 0n;
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
    });


    return {
        stakeSum: stakeSum.toString(),
    }
}
