import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { TotalValueLockedResource } from '@jsinfo/redis/resources/ajax/TotalValueLockedResource';
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

    reply.header('Content-Type', 'application/json');
    return JSONStringify(totalValueLockedItems);
}


