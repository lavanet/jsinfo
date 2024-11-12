// src/query/handlers/indexTopChainsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt } from "drizzle-orm";

export const IndexTopChainsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    allSpecs: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function IndexTopChainsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    // Get top chains
    let topSpecs = await QueryGetJsinfoDbForQueryInstance().select({
        chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) as relaySum`,
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}) as cuSum`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
        groupBy(sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`).
        where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`)).
        orderBy(sql`relaySum DESC`)

    return {
        allSpecs: topSpecs,
    }
}
