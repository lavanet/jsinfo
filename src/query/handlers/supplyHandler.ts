// src/query/handlers/supplyHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance } from '../queryDb';
import { JSINFO_QUERY_LAVA_CHAIN_ID } from '../queryConsts';

export const TotalSupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number'
                    },
                    chain_id: {
                        type: 'string'
                    },
                }
            }
        }
    }
}

export const CirculatingSupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    amount: {
                        type: 'number'
                    },
                    chain_id: {
                        type: 'string'
                    },
                }
            }
        }
    }
}


export async function TotalSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return {
        amount: 1000000000,
        chain_id: JSINFO_QUERY_LAVA_CHAIN_ID,
    }
}

export async function CirculatingSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return {
        amount: 1000000000,
        chain_id: JSINFO_QUERY_LAVA_CHAIN_ID,
    }
}