
// src/query/handlers/specStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { ReplaceArchive } from '../../../indexer/indexerUtils';
import { GetAndValidateSpecIdFromRequest } from '../../utils/queryRequestArgParser';
import { MonikerCache } from '../../classes/MonikerCache';
import { BigIntIsZero } from '../../../utils/utils';

export type SpecSpecsResponse = {
    stake: string;
    delegateLimit: string;
    delegateTotal: string;
    delegateCommission: string;
    totalStake: string;
    appliedHeight: number | null;
    geolocation: number | null;
    addons: string;
    extensions: string;
    status: number | null;
    provider: string | null;
    moniker: string | null;
    monikerfull: string | null;
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
                                    type: ['string', 'null']
                                },
                                delegateLimit: {
                                    type: ['string', 'null']
                                },
                                delegateTotal: {
                                    type: ['string', 'null']
                                },
                                delegateCommission: {
                                    type: ['string', 'null']
                                },
                                totalStake: {
                                    type: ['string', 'null']
                                },
                                appliedHeight: {
                                    type: ['number', 'null']
                                },
                                geolocation: {
                                    type: ['number', 'null']
                                },
                                addons: {
                                    type: 'string'
                                },
                                extensions: {
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
                                monikerfull: {
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
        return reply;
    }

    await QueryCheckJsinfoReadDbInstance();

    let stakesRes = await QueryGetJsinfoReadDbInstance().select({
        stake: JsinfoSchema.providerStakes.stake,
        delegateLimit: JsinfoSchema.providerStakes.delegateLimit,
        delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
        delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
        totalStake: sql<bigint>`(${JsinfoSchema.providerStakes.stake} + LEAST(${JsinfoSchema.providerStakes.delegateTotal}, ${JsinfoSchema.providerStakes.delegateLimit})) as totalStake`,
        appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
        geolocation: JsinfoSchema.providerStakes.geolocation,
        addons: sql<string>`COALESCE(${JsinfoSchema.providerStakes.addons}, '')`,
        extensions: sql<string>`COALESCE(${JsinfoSchema.providerStakes.extensions}, '')`,
        status: JsinfoSchema.providerStakes.status,
        provider: JsinfoSchema.providerStakes.provider,
        blockId: JsinfoSchema.providerStakes.blockId,
    }).from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.specId, spec))
        .orderBy(desc(JsinfoSchema.providerStakes.stake))
        .offset(0).limit(200);

    let aggRes90Days = await QueryGetJsinfoReadDbInstance().select({
        provider: JsinfoSchema.providerStakes.provider,
        cuSum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum90Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoSchema.providerStakes)
        .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, and(
            eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
            and(
                eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '90 day'`)
            )
        ))
        .where(eq(JsinfoSchema.providerStakes.specId, spec))
        .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId)
        .offset(0).limit(200);

    let aggRes90DaysMap = new Map(aggRes90Days.map(item => [item.provider, item]));

    // Query for 30 days
    let aggRes30Days = await QueryGetJsinfoReadDbInstance().select({
        provider: JsinfoSchema.providerStakes.provider,
        cuSum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
        relaySum30Days: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
    }).from(JsinfoSchema.providerStakes)
        .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments, and(
            eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
            and(
                eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`)
            )
        ))
        .where(eq(JsinfoSchema.providerStakes.specId, spec))
        .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId)
        .offset(0).limit(200);

    let aggRes30DaysMap = new Map(aggRes30Days.map(item => [item.provider, item]));

    // Combine results
    let combinedStakesRes: SpecSpecsResponse[] = stakesRes.map((itemStakesRes) => {
        let item90Days = aggRes90DaysMap.get(itemStakesRes.provider);
        let item30Days = aggRes30DaysMap.get(itemStakesRes.provider);
        return {
            ...itemStakesRes,
            stake: BigIntIsZero(itemStakesRes.stake) ? "0" : itemStakesRes.stake?.toString() ?? "0",
            delegateLimit: BigIntIsZero(itemStakesRes.delegateLimit) ? "0" : itemStakesRes.delegateLimit?.toString() ?? "0",
            delegateTotal: BigIntIsZero(itemStakesRes.delegateTotal) ? "0" : itemStakesRes.delegateTotal?.toString() ?? "0",
            delegateCommission: BigIntIsZero(itemStakesRes.delegateCommission) ? "0" : itemStakesRes.delegateCommission?.toString() ?? "0",
            totalStake: BigIntIsZero(itemStakesRes.totalStake) ? "0" : itemStakesRes.totalStake?.toString() ?? "0",
            addons: itemStakesRes.addons,
            extensions: ReplaceArchive(itemStakesRes.extensions),
            moniker: MonikerCache.GetMonikerForProvider(itemStakesRes.provider),
            monikerfull: MonikerCache.GetMonikerFullDescription(itemStakesRes.provider),
            cuSum30Days: item30Days ? item30Days.cuSum30Days || 0 : 0,
            relaySum30Days: item30Days ? item30Days.relaySum30Days || 0 : 0,
            cuSum90Days: item90Days ? item90Days.cuSum90Days || 0 : 0,
            relaySum90Days: item90Days ? item90Days.relaySum90Days || 0 : 0,
        };
    }).sort((a, b) => b.cuSum90Days - a.cuSum90Days);

    return { data: combinedStakesRes };
}
