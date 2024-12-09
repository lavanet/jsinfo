// src/query/handlers/provider/providerCardsDelegatorRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { queryJsinfo } from '@jsinfo/utils/db';
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
    const ret = await queryJsinfo(
        async (db) => await db.select()
            .from(JsinfoSchema.delegatorRewards)
            .where(eq(JsinfoSchema.delegatorRewards.delegator, addr))
            .limit(1),
        `ProviderCardsDelegatorRewards_getDelegatorRewards_${addr}`
    );

    return ret[0] || { "error": "No data found" };
}

export async function ProviderCardsDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("ProviderCardsDelegatorRewards", request, reply);
    if (addr === '') {
        return null;
    }

    return await getDelegatorRewards(addr);
}