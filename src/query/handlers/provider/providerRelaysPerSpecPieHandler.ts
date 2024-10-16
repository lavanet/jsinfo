// src/query/handlers/provider/providerRelaysPerSpecPieHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPayments';
import { sql, eq, desc } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ProviderRelaysPerSpecPieHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    chartData: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number' },
                                value: { type: 'string' },
                                label: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }
}

export async function ProviderRelaysPerSpecPieHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerRelaysPerSpecPie", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const relaysPerSpec = await QueryGetJsinfoReadDbInstance()
        .select({
            specId: JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.specId,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.relaySum})`,
        })
        .from(JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments)
        .where(eq(JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.provider, addr))
        .groupBy(JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.specId)
        .orderBy(desc(sql<number>`SUM(${JsinfoProviderAgrSchema.aggTotalProviderRelayMvPayments.relaySum})`));

    const topSpecs = relaysPerSpec.slice(0, 4);
    const otherSpecs = relaysPerSpec.slice(4);

    const chartData = topSpecs.map((spec, index) => ({
        id: index,
        value: spec.relaySum.toString(), // Convert to string
        label: spec.specId
    }));

    if (otherSpecs.length > 0) {
        const otherRelaySum = otherSpecs.reduce((sum, spec) => sum + Number(spec.relaySum), 0);
        chartData.push({
            id: 4,
            value: otherRelaySum.toString(), // Convert to string
            label: 'Other'
        });
    }

    return { chartData };
}