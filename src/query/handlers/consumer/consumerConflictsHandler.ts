
// src/query/handlers/consumer/consumerConflictsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { desc, eq } from "drizzle-orm";
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';
import { queryJsinfo } from '@jsinfo/utils/db';

export const ConsumerConflictsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    addr: {
                        type: 'string'
                    },
                    conflicts: {
                        type: 'array'
                    },
                }
            }
        }
    }
}

export async function ConsumerConflictsHandler(request: FastifyRequest, reply: FastifyReply) {

    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }

    let conflictsRet = await queryJsinfo(
        async (db) => await db.select().from(JsinfoSchema.conflictResponses).where(eq(JsinfoSchema.conflictResponses.consumer, addr)).
            orderBy(desc(JsinfoSchema.conflictResponses.id)).offset(0).limit(50),
        `ConsumerConflictsHandler_${addr}`
    );

    return {
        addr: addr,
        conflicts: conflictsRet,
    }
}