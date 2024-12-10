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
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const totalLava = totalValueLockedItems.reduce((sum, item) => sum + item.ulavaValue, 0) / 1000000;

    return { tvl: totalLava.toFixed(4) };
}