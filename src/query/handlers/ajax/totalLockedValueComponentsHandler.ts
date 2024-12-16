import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { TotalValueLockedItem, TotalValueLockedResource } from '@jsinfo/redis/resources/ajax/TotalValueLockedResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const TotalValueLockedComponentsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
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

export async function TotalValueLockedComponentsHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new TotalValueLockedResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const total: TotalValueLockedItem = {
        key: 'Total',
        ulavaValue: totalValueLockedItems.reduce((sum, item) => sum + item.ulavaValue, 0),
        USDValue: totalValueLockedItems.reduce((sum, item) => sum + item.USDValue, 0)
    };

    totalValueLockedItems.push(total);

    reply.header('Content-Type', 'application/json');
    return JSONStringify(totalValueLockedItems);
}


