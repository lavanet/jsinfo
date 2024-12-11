// src/query/handlers/provider/providerCardsStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { ProviderStakesAndDelegationResource } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';

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

export async function ProviderCardsStakesHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsStakes", request, reply);
    if (addr === '') {
        return null;
    }

    const resource = new ProviderStakesAndDelegationResource();
    const result = await resource.fetch();
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch stakes data' });
        return reply;
    }

    const providerStake = result.providerStakes[addr];
    if (!providerStake) {
        reply.status(404);
        reply.send({ error: 'Provider stake not found' });
        return reply;
    }

    return {
        stakeSum: (BigInt(providerStake.stake) + BigInt(providerStake.delegateTotal)).toString()
    };
}