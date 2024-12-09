import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { TotalValueLockedResource } from '@jsinfo/redis/resources/ajax/TotalValueLockedResource';

export const TotalValueLockedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    tvl: {
                        type: 'string'
                    }
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

export async function TotalValueLockedHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new TotalValueLockedResource();
    const totalValueLocked = await resource.fetch();

    if (totalValueLocked === undefined || totalValueLocked === null) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    return { tvl: totalValueLocked.toFixed(4) };
}