// src/query/handlers/SupplyHistoryService.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { SupplyHistoryService } from '@jsinfo/redis/resources/ajax/SupplyHistoryResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const SupplyHistoryHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
}

export async function supplyHistoryHandler(_: FastifyRequest, reply: FastifyReply) {
    try {
        const history = await SupplyHistoryService.fetch({});
        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(history));
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch supply history' });
    }
}

