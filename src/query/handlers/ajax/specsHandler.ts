// src/query/handlers/specsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance } from '../../utils/getLatestBlock';
import { SpecAndConsumerService } from '@jsinfo/redis/resources/global/SpecAndConsumerResource';

export const SpecsPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    specs: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function SpecsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const res = await SpecAndConsumerService.GetAllSpecs();

    return {
        specs: res,
    }
}
