// src/query/handlers/provider/providerRelaysPerSpecPieHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
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

    // const relaysPerSpec = await QueryGetJsinfoReadDbInstance()
    //     .select({
    //         specId: JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId,
    //         relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`,
    //     })
    //     .from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)
    //     .where(eq(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider, addr))
    //     .groupBy(JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId)
    //     .orderBy(desc(sql<number>`SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.relaySum})`));

    const relaysPerSpec = await QueryGetJsinfoReadDbInstance()
        .select({
            specId: sql`arp."spec_id"`,
            relaySum: sql<number>`SUM(arp."total_relaysum")`,
        })
        .from(sql`agg_total_provider_relay_payments as arp`)
        .where(eq(sql`arp."provider"`, addr))
        .groupBy(sql`arp."spec_id"`)
        .orderBy(desc(sql<number>`SUM(arp."total_relaysum")`));


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