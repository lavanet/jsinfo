// src/query/handlers/indexTotalCuHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPayments';
import { sql } from "drizzle-orm";
import { logger } from '../../../utils/utils';

export const IndexTotalCuHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: {
                        type: 'number'
                    },
                    relaySum: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function IndexTotalCuHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    // Get total payments and more
    let cuSum = 0
    let relaySum = 0

    const query = QueryGetJsinfoReadDbInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments)

    logger.info('Generat111111ed SQL query:', { sql: query.toSQL() });

    const res = await query;

    if (res.length != 0) {
        cuSum = res[0].cuSum
        relaySum = res[0].relaySum
    }

    return {
        cuSum: cuSum,
        relaySum: relaySum,
    }
}
