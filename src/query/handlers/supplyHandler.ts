// src/query/handlers/supplyHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { JSINFO_QUERY_LAVA_CHAIN_ID } from '../queryConsts';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';

export const SupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    chain_id: {
                        type: 'string'
                    },
                    total_supply: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number' },
                            denom: { type: 'string' },
                            timestamp: { type: 'string' },
                        }
                    },
                    circulating_supply: {
                        type: 'object',
                        properties: {
                            amount: { type: 'number' },
                            denom: { type: 'string' },
                            timestamp: { type: 'string' },
                        }
                    }
                }
            }
        }
    }
}

export async function SupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const supplydb = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.supply);

    const supplyData = supplydb.reduce((acc, row) => {
        acc.set(row.key, {
            amount: row.amount.toString(),
            timestamp: row.timestamp.toISOString(),
        });
        return acc;
    }, new Map());

    const getSupplyData = (key) => {
        const data = supplyData.get(key);
        return data ? data : { amount: "-", timestamp: "-", denom: "ulava" };
    };

    return {
        chain_id: JSINFO_QUERY_LAVA_CHAIN_ID,
        total_supply: getSupplyData("total"),
        circulating_supply: getSupplyData("circulating"),
    };
}