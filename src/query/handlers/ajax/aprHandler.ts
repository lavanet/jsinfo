// src/query/handlers/aprHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';

export const APRRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
}

export async function APRRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const result = await QueryGetJsinfoReadDbInstance()
        .select({ key: JsinfoSchema.apr.key, value: JsinfoSchema.apr.value })
        .from(JsinfoSchema.apr)

    const aprData: { [key: string]: number } = {}
    result.forEach(row => {
        aprData[row.key] = row.value
    })

    return JSON.stringify(aprData)
}
