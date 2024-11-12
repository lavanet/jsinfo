// src/query/handlers/index30DayCuHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, GetLatestBlock, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt } from "drizzle-orm";

export const Index30DayCuHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum30Days: {
                        type: 'number'
                    },
                    relaySum30Days: {
                        type: 'number'
                    },
                }
            }
        }
    }
}

export async function Index30DayCuHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    let cuSum30Days = 0
    let relaySum30Days = 0
    let res30Days = await QueryGetJsinfoDbForQueryInstance().select({
        cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
        where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`))

    if (res30Days.length != 0) {
        cuSum30Days = res30Days[0].cuSum
        relaySum30Days = res30Days[0].relaySum
    }

    return {
        cuSum30Days: cuSum30Days,
        relaySum30Days: relaySum30Days,
    }
}
