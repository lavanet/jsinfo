// src/query/handlers/indexMonthlyUsersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';

export const IndexMonthlyUsersHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    monthlyUsers: {
                        type: 'string'
                    },
                }
            }
        }
    }
}

export async function IndexMonthlyUsersHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    // Get total provider stake
    let uniqueUsers = await QueryGetJsinfoReadDbInstance().select({
        value: JsinfoSchema.visitorMetrics.value
    }).from(JsinfoSchema.visitorMetrics)
        .where(eq(JsinfoSchema.visitorMetrics.key, 'Unique Users (30 days)'));

    if (uniqueUsers.length == 0) {
        WriteErrorToFastifyReply(reply, "Missing metrics on server");
        return null;
    }

    return {
        monthlyUsers: uniqueUsers[0].value,
    }
}
