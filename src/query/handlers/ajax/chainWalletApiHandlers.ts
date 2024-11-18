// src/query/handlers/ajax/chainWalletApiHandlers.ts
// curl http://localhost:8081/lava_chain_stakers
// curl http://localhost:8081/lava_chain_restakers

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ChainWalletResource, ChainWalletData } from '../../../redis/resources/ajax/ChainWalletResource';

export const ChainWalletApiHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    total: { type: 'string' },
                    monthly: { type: 'string' }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

export async function LavaChainStakersHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<ChainWalletData> {
    const resource = new ChainWalletResource();
    const result = await resource.fetchAndPickDb({ type: 'stakers' });
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch stakers data' });
        return reply;
    }
    return result;
}

export async function LavaChainRestakersHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<ChainWalletData> {
    const resource = new ChainWalletResource();
    const result = await resource.fetchAndPickDb({ type: 'restakers' });
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch restakers data' });
        return reply;
    }
    return result;
}