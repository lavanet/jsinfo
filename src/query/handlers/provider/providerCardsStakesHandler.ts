// src/query/handlers/provider/providerCardsStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { desc, eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { MinBigInt } from '../../../utils/utils';

export const ProviderCardsStakesHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    stakeSum: { type: 'string' }
                }
            }
        }
    }
}

async function getStakes(addr: string): Promise<bigint> {
    const stakesRes = await QueryGetJsinfoReadDbInstance()
        .select()
        .from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.provider, addr))
        .orderBy(desc(JsinfoSchema.providerStakes.stake));

    let stakeSum = 0n;
    stakesRes.forEach((stake) => {
        stakeSum += stake.stake! + MinBigInt(stake.delegateTotal, stake.delegateLimit);
    });

    return stakeSum;
}

export async function ProviderCardsStakesHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsStakes", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const stakeSum = await getStakes(addr);

    return {
        stakeSum: stakeSum.toString()
    };
}