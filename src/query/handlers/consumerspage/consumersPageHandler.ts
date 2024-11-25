// src/query/handlers/consumerspageHandler.ts

// curl http://localhost:8081/consumerspage | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock } from '../../utils/getLatestBlock';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { sql } from "drizzle-orm";
import { queryJsinfo } from '@jsinfo/utils/db';

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


    const { latestHeight, latestDatetime } = await GetLatestBlock()

    const uniqueConsumerCount = await queryJsinfo<{ count: number }[]>(
        async (db) => await db.select({
            count: sql<number>`COUNT(DISTINCT consumer)`
        })
            .from(JsinfoSchema.consumerSubscriptionList),
        `ConsumersPage_getUniqueConsumerCount_${latestHeight}`
    );

    const consumerCountRes = uniqueConsumerCount[0].count || 0;

    return {
        height: latestHeight,
        datetime: latestDatetime,
        consumerCount: consumerCountRes,
    }
}
