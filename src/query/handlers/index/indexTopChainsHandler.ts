// src/query/handlers/indexTopChainsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPayments';
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
    await QueryCheckJsinfoReadDbInstance()

    // Get top chains
    let topSpecs = await QueryGetJsinfoReadDbInstance().select({
        chainId: JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments.specId,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments.relaySum}) as relaySum`,
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments.cuSum}) as cuSum`,
    }).from(JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments).
        groupBy(sql`${JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments.specId}`).
        where(gt(JsinfoProviderAgrSchema.agg15MinProviderRelayTsPayments.dateday, sql<Date>`now() - interval '30 day'`)).
        orderBy(sql`relaySum DESC`)

    return {
        allSpecs: topSpecs,
    }
}
