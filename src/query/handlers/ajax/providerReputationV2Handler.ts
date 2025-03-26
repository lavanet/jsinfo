import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { LavaRpcProviderReputation } from '@jsinfo/restRpc/LavaRpcProviderReputation';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const ProviderReputationV2HandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function providerReputationV2Handler(_: FastifyRequest, reply: FastifyReply) {
    try {
        const reputationData = await LavaRpcProviderReputation.GetAllProviderReputationData();
        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(reputationData));
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch provider reputation data' });
    }
}
