// src/query/handlers/supplyHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { SupplyResource } from '@jsinfo/redis/resources/ajax/SupplyResource';

export const SupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
}

export async function TotalSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const supplyResource = new SupplyResource();
    const result = await supplyResource.fetch({ type: 'total' });
    return result?.amount || 0;
}

export async function CirculatingSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const supplyResource = new SupplyResource();
    const result = await supplyResource.fetch({ type: 'circulating' });
    return result?.amount || 0;
}

