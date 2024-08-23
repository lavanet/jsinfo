// src/query/handlers/consumerspageHandler.ts

// curl http://localhost:8081/consumerspage | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { sql } from "drizzle-orm";

export const ConsumersPageHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: {
                        type: 'number'
                    },
                    datetime: {
                        type: 'number'
                    },
                    consumerCount: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function ConsumersPageHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    const uniqueConsumerCount = await QueryGetJsinfoReadDbInstance()
        .select({
            count: sql<number>`COUNT(DISTINCT consumer)`
        })
        .from(JsinfoSchema.consumerSubscriptionList);

    const consumerCountRes = uniqueConsumerCount[0].count || 0;

    return {
        height: latestHeight,
        datetime: latestDatetime,
        consumerCount: consumerCountRes,
    }
}
