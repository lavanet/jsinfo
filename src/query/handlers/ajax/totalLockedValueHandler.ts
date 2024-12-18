import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { LockedTokenValuesResource } from '@jsinfo/redis/resources/ajax/LockedTokenValuesResource';

export const TotalLockedValueHandlerOpts: RouteShorthandOptions = {
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

export async function TotalLockedValueHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new LockedTokenValuesResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const totalLava = totalValueLockedItems
        .filter(item => item.countForTlv)
        .reduce((sum, item) => sum + item.USDValue, 0)

    return { tvl: totalLava.toFixed(4) };
}