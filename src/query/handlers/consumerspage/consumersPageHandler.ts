// src/query/handlers/consumerspageHandler.ts

// curl http://localhost:8081/consumerspage | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, GetLatestBlock, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
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
    await QueryCheckJsinfoDbInstance()

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    const uniqueConsumerCount = await QueryGetJsinfoDbForQueryInstance()
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
