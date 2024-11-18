// src/query/handlers/provider/providerCardsDelegatorRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ProviderCardsDelegatorRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                additionalProperties: true,
                type: 'object'
            }
        }
    }
}

async function getDelegatorRewards(addr: string) {
    let ret = await QueryGetJsinfoDbForQueryInstance()
        .select()
        .from(JsinfoSchema.delegatorRewards)
        .where(eq(JsinfoSchema.delegatorRewards.delegator, addr))
        .limit(1);
    return ret[0] || { "error": "No data found" };
}

export async function ProviderCardsDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("ProviderCardsDelegatorRewards", request, reply);
    if (addr === '') {
        return null;
    }

    await QueryCheckJsinfoDbInstance();

    return await getDelegatorRewards(addr);
}