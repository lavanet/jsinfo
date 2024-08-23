// src/query/handlers/indexMonthlyUsersAvgHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq, sql } from "drizzle-orm";
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';

export const IndexMonthlyUsersAvgHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    monthlyUsersAvg: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function IndexMonthlyUsersAvgHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    let uniqueUsersAvg = await QueryGetJsinfoReadDbInstance().select({
        value: sql<number>`AVG(${JsinfoSchema.uniqueVisitors.value})`
    }).from(JsinfoSchema.uniqueVisitors)

    if (uniqueUsersAvg.length == 0) {
        WriteErrorToFastifyReply(reply, "Missing unique visitors data");
        return null;
    }

    return {
        monthlyUsersAvg: Math.round(uniqueUsersAvg[0].value),
    }
}
