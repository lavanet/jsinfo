// src/query/handlers/specChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt, and, lt, eq, inArray } from "drizzle-orm";
import { DateToISOString, FormatDateItems } from '../utils/queryDateUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';
import { GetAndValidateSpecIdFromRequest, GetDataLength } from '../utils/queryUtils';
import { MonikerCache } from '../classes/MonikerCache';
import { PgColumn } from 'drizzle-orm/pg-core';
import { JSONStringifySpaced } from '../../utils/utils';

type SpecChartCuRelay = {
    provider: string;
    cus: number;
    relays: number;
};

type SpecChartResponse = {
    data: SpecChartCuRelay[];
} & SpecQosData;

interface QosQueryData {
    date: string | null;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

type SpecQosData = {
    qos: number;
} & QosQueryData;

interface SpecCuRelayQueryData {
    date: string | null;
    cuSum: number;
    relaySum: number;
}

type SpecCuRelayQueryDataWithProvider = {
    provider: string | null;
} & SpecCuRelayQueryData;

interface SpecCuRelayData {
    date: string;
    providerOrMoniker: string;
    cus: number;
    relays: number;
}

export const SpecChartsRawHandlerOpts: RouteShorthandOptions = {
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
                                date: { type: 'string' },
                                qos: { type: 'number' },
                                qosSyncAvg: { type: 'number' },
                                qosAvailabilityAvg: { type: 'number' },
                                qosLatencyAvg: { type: 'number' },
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            provider: { type: 'string' },
                                            cus: { type: 'number' },
                                            relays: { type: 'number' },
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class SpecChartsData extends RequestHandlerBase<SpecChartResponse> {
    private spec: string;
    private specTop10ProvidersCache: { [key: string]: string } | null = null;

    constructor(spec: string) {
        super("SpecChartsData");
        this.spec = spec;
    }

    public static GetInstance(spec: string): SpecChartsData {
        return SpecChartsData.GetInstanceBase(spec);
    }

    private async getSpecTop10Providers(): Promise<{ [key: string]: string }> {
        // Check if we already have the result cached
        if (this.specTop10ProvidersCache) {
            return this.specTop10ProvidersCache;
        }

        // First query to get top 10 providers
        let top10Providers = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
        }).from(JsinfoSchema.providerStakes)
            .where(eq(JsinfoSchema.providerStakes.specId, this.spec))
            .orderBy(desc(JsinfoSchema.providerStakes.stake))
            .limit(10);

        // Check if any provider is an empty string
        top10Providers.forEach(item => {
            if (!item.provider) {
                throw new Error("Provider is an empty string");
            }
        });

        // Populate monikers
        let result = top10Providers.reduce((acc, item) => {
            let moniker = MonikerCache.GetMonikerForProvider(item.provider);
            return {
                ...acc,
                [item.provider!]: moniker || item.provider, // Fallback to provider if moniker is not found
            };
        }, {});

        // Cache the result before returning
        this.specTop10ProvidersCache = result;

        return result;
    }

    private async getSpecQosData(from: Date, to: Date): Promise<SpecQosData[]> {
        const formatedData: SpecQosData[] = [];

        const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

        let monthlyData: QosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
            .where(and(
                and(
                    gt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${from}`),
                    lt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${to}`)
                ),
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.spec)
            ))
            .orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

        // Verify and format the data
        monthlyData.forEach(item => {
            item.qosSyncAvg = Number(item.qosSyncAvg);
            item.qosAvailabilityAvg = Number(item.qosAvailabilityAvg);
            item.qosLatencyAvg = Number(item.qosLatencyAvg);

            if (!item.date || isNaN(Date.parse(item.date))) {
                throw new Error(`Data format does not match the QosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.date is not a valid date.`);
            } else if (isNaN(item.qosSyncAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosSyncAvg is not a number.`);
            } else if (isNaN(item.qosAvailabilityAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosAvailabilityAvg is not a number.`);
            } else if (isNaN(item.qosLatencyAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosLatencyAvg is not a number.`);
            }

            const qos = Math.cbrt(item.qosSyncAvg * item.qosAvailabilityAvg * item.qosLatencyAvg);

            formatedData.push({
                date: DateToISOString(item.date),
                qos: qos,
                qosSyncAvg: item.qosSyncAvg,
                qosAvailabilityAvg: item.qosAvailabilityAvg,
                qosLatencyAvg: item.qosLatencyAvg
            });
        });

        return formatedData;
    }

    private async getSpecRelayCuChartWithTopProviders(from: Date, to: Date, top10Providers: any): Promise<SpecCuRelayData[]> {
        const formatedData: SpecCuRelayData[] = [];

        let allProvidersMonthlyData: SpecCuRelayQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            cuSum: sql<number>`SUM(COALESCE(NULLIF(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}, 0), 0))`,
            relaySum: sql<number>`SUM(COALESCE(NULLIF(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0), 0))`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
            .where(and(
                and(
                    gt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${from}`),
                    lt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${to}`)
                ),
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.spec)
            )).orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

        allProvidersMonthlyData.forEach(item => {
            formatedData.push({
                date: DateToISOString(item.date),
                cus: item.cuSum,
                relays: item.relaySum,
                providerOrMoniker: "All Providers"
            });
        });

        let providers = Object.keys(top10Providers);
        let monthlyData: SpecCuRelayQueryDataWithProvider[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            cuSum: sql<number>`SUM(COALESCE(NULLIF(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}, 0), 0))`,
            relaySum: sql<number>`SUM(COALESCE(NULLIF(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0), 0))`,
            provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
            .where(and(
                and(
                    gt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${from}`),
                    lt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${to}`)
                ),
                and(
                    eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.spec),
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, providers)
                )
            )).orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

        monthlyData.forEach(item => {
            let item_provider = item.provider!;
            let providerOrMoniker = top10Providers[item_provider] ? top10Providers[item_provider] : item.provider;
            formatedData.push({
                date: DateToISOString(item.date),
                cus: item.cuSum,
                relays: item.relaySum,
                providerOrMoniker: providerOrMoniker
            });
        });

        return formatedData;
    }

    private combineData(specMainChartData: SpecCuRelayData[], specQosData: SpecQosData[]): SpecChartResponse[] {
        // Group the specMainChartData by date
        const groupedData: { [key: string]: SpecChartCuRelay[] } = specMainChartData.reduce((acc, item) => {
            const dateKey = DateToISOString(item.date);
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push({
                provider: item.providerOrMoniker,
                cus: item.cus,
                relays: item.relays
            });
            return acc;
        }, {});

        // Merge the specQosData with groupedData
        return specQosData.map(specQosData => {
            return {
                ...specQosData,
                data: groupedData[specQosData.date!] || []
            };
        });
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<SpecChartResponse[]> {

        const specTop10Providers = await this.getSpecTop10Providers();
        if (GetDataLength(specTop10Providers) === 0) {
            return [];
        }

        const specMainChartData = await this.getSpecRelayCuChartWithTopProviders(from, to, specTop10Providers);
        const specQosData = await this.getSpecQosData(from, to);
        const specCombinedData = this.combineData(specMainChartData, specQosData);

        return specCombinedData;
    }
}

export async function SpecChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    let ret: { data: SpecChartResponse[] } | null = await SpecChartsData.GetInstance(spec).DateRangeRequestHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    let formattedData: SpecChartResponse[] = FormatDateItems<SpecChartResponse>(ret.data);

    return reply.send({ data: formattedData });
}