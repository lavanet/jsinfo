
// src/query/handlers/provider/providerCardsCuRelayAndRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ProviderCardsCuRelayAndRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cuSum: { type: 'number' },
                    relaySum: { type: 'number' },
                    rewardSum: { type: 'number' }
                }
            }
        }
    }
}

async function getCuRelayAndRewardsTotal(addr: string) {
    const result = await QueryGetJsinfoReadDbInstance()
        .select({
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
            rewardSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum})`,
        })
        .from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
        .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider, addr))
        .groupBy(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider);

    if (result.length === 1) {
        return {
            cuSum: result[0].cuSum,
            relaySum: result[0].relaySum,
            rewardSum: result[0].rewardSum
        };
    }

    return { cuSum: 0, relaySum: 0, rewardSum: 0 };
}

export async function ProviderCardsCuRelayAndRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsCuRelayAndRewards", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const { cuSum, relaySum, rewardSum } = await getCuRelayAndRewardsTotal(addr);

    return {
        cuSum,
        relaySum,
        rewardSum
    };
}