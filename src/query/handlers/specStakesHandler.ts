
// src/query/handlers/specStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { ReplaceArchive } from '../../indexer/indexerUtils';
import { GetAndValidateSpecIdFromRequest } from '../utils/queryUtils';

export type SpecSpecsResponse = {
    stake: number | null;
    appliedHeight: number | null;
    geolocation: number | null;
    addonsAndExtensions: string;
    status: number | null;
    provider: string | null;
    moniker: string | null;
    blockId: number | null;
    cuSum90Days: number;
    cuSum30Days: number;
    relaySum90Days: number;
    relaySum30Days: number;
};

export const SpecStakesPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                stake: {
                                    type: ['number', 'null']
                                },
                                appliedHeight: {
                                    type: ['number', 'null']
                                },
                                geolocation: {
                                    type: ['number', 'null']
                                },
                                addonsAndExtensions: {
                                    type: 'string'
                                },
                                status: {
                                    type: ['number', 'null']
                                },
                                provider: {
                                    type: ['string', 'null']
                                },
                                moniker: {
                                    type: ['string', 'null']
                                },
                                blockId: {
                                    type: ['number', 'null']
                                },
                                cuSum30Days: {
                                    type: 'number'
                                },
                                relaySum30Days: {
                                    type: 'number'
                                },
                                cuSum90Days: {
                                    type: 'number'
                                },
                                relaySum90Days: {
                                    type: 'number'
                                },
                            }
                        }
                    }
                }
            }
        }
    }
};

export async function SpecStakesPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }

    await QueryCheckJsinfoReadDbInstance();

    // Query for 90 days
    let stakesRes90Days = await QueryGetJsinfoReadDbInstance().select({
        stake: JsinfoSchema.providerStakes.stake,
        appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
        geolocation: JsinfoSchema.providerStakes.geolocation,
        addonsAndExtensions: sql<string>`TRIM(TRAILING ', ' FROM CASE 
        WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' AND COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN '-' 
        WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' THEN 'extensions: ' || ${JsinfoSchema.providerStakes.extensions}
        WHEN COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN 'addons: ' || ${JsinfoSchema.providerStakes.addons}
        ELSE 'addons: ' || ${JsinfoSchema.providerStakes.addons} || ', extensions: ' || ${JsinfoSchema.providerStakes.extensions} 
    END)`,
        status: JsinfoSchema.providerStakes.status,
        provider: JsinfoSchema.providerStakes.provider,
        moniker: JsinfoSchema.providers.moniker,
        blockId: JsinfoSchema.providerStakes.blockId,
        cuSum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoSchema.providerStakes)
        .groupBy(JsinfoSchema.providerStakes.stake, JsinfoSchema.providerStakes.appliedHeight, JsinfoSchema.providerStakes.geolocation,
            JsinfoSchema.providerStakes.addons, JsinfoSchema.providerStakes.extensions, JsinfoSchema.providerStakes.status,
            JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId, JsinfoSchema.providers.moniker,
            JsinfoSchema.providerStakes.blockId)
        .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
        .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, and(
            eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
            and(
                eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '90 day'`)
            )
        ))
        .where(eq(JsinfoSchema.providerStakes.specId, spec))
        .orderBy(desc(JsinfoSchema.providerStakes.stake))
        .offset(0).limit(200);

    // Query for 30 days
    let stakesRes30Days = await QueryGetJsinfoReadDbInstance().select({
        provider: JsinfoSchema.providerStakes.provider,
        cuSum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoSchema.providerStakes)
        .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
        .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, and(
            eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
            and(
                eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`)
            )
        ))
        .where(eq(JsinfoSchema.providerStakes.specId, spec))
        .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId, JsinfoSchema.providers.moniker, JsinfoSchema.providerStakes.stake)
        .orderBy(desc(JsinfoSchema.providerStakes.stake))
        .offset(0).limit(200);

    let stakesRes30DaysMap = new Map(stakesRes30Days.map(item => [item.provider, item]));

    let combinedStakesRes: SpecSpecsResponse[] = stakesRes90Days.map((item90Days) => {
        let item30Days = stakesRes30DaysMap.get(item90Days.provider);
        return {
            ...item90Days,
            relaySum90Days: item90Days.relaySum90Days || 0,
            cuSum90Days: item90Days.cuSum90Days || 0,
            cuSum30Days: item30Days ? item30Days.cuSum30Days || 0 : 0,
            relaySum30Days: item30Days ? item30Days.relaySum30Days || 0 : 0,
            addonsAndExtensions: ReplaceArchive(item90Days.addonsAndExtensions),
        };
    }).sort((a, b) => b.cuSum90Days - a.cuSum90Days);

    return { data: combinedStakesRes };
}
