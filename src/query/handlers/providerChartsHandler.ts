// src/query/handlers/providerChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt, and, lt, desc, eq } from "drizzle-orm";
import { DateToISOString, FormatDateItems } from '../utils/queryDateUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';
import { GetAndValidateProviderAddressFromRequest, GetDataLength } from '../utils/queryUtils';
import { PgColumn } from 'drizzle-orm/pg-core';

type ProviderChartCuRelay = {
    specId: string;
    cus: number;
    relays: number;
};

type ProviderChartResponse = {
    data: ProviderChartCuRelay[];
} & ProviderQosData;

interface ProviderQosQueryData {
    date: string | null;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

type ProviderQosData = {
    qos: number;
} & ProviderQosQueryData;

interface SpecCuRelayQueryData {
    date: string | null;
    cuSum: number;
    relaySum: number;
}

type ProviderCuRelayQueryDataWithSpecId = {
    specId: string | null;
} & SpecCuRelayQueryData;

interface ProviderCuRelayData {
    date: string;
    specId: string;
    cus: number;
    relays: number;
}

export const ProviderChartsRawHandlerOpts: RouteShorthandOptions = {
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
                                            specId: { type: 'string' },
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

class ProviderChartsData extends RequestHandlerBase<ProviderChartResponse> {
    private provider: string;

    constructor(provider: string) {
        super("ProviderChartsData");
        this.provider = provider;
    }

    public static GetInstance(provider: string): ProviderChartsData {
        return ProviderChartsData.GetInstanceBase(provider);
    }

    private async getProviderQosData(from: Date, to: Date): Promise<ProviderQosData[]> {
        const formatedData: ProviderQosData[] = [];

        const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

        let monthlyData: ProviderQosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
            .where(and(
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider),
                and(
                    gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                    lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
                )))
            .orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

        monthlyData.forEach(item => {
            item.qosSyncAvg = Number(item.qosSyncAvg);
            item.qosAvailabilityAvg = Number(item.qosAvailabilityAvg);
            item.qosLatencyAvg = Number(item.qosLatencyAvg);

            if (!item.date || isNaN(Date.parse(item.date))) {
                throw new Error(`Data format does not match the ProviderQosQueryData interface.Item: ${JSON.stringify(item)}.Reason: item.date is not a valid date.`);
            } else if (isNaN(item.qosSyncAvg)) {
                throw new Error(`Data format does not match the ProviderQosQueryData interface.Item: ${JSON.stringify(item)}.Reason: item.qosSyncAvg is not a number.`);
            } else if (isNaN(item.qosAvailabilityAvg)) {
                throw new Error(`Data format does not match the ProviderQosQueryData interface.Item: ${JSON.stringify(item)}.Reason: item.qosAvailabilityAvg is not a number.`);
            } else if (isNaN(item.qosLatencyAvg)) {
                throw new Error(`Data format does not match the ProviderQosQueryData interface.Item: ${JSON.stringify(item)}.Reason: item.qosLatencyAvg is not a number.`);
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

    private async getSpecRelayCuChartWithTopProviders(from: Date, to: Date): Promise<ProviderCuRelayData[]> {
        const formatedData: ProviderCuRelayData[] = [];

        let monthlyData: ProviderCuRelayQueryDataWithSpecId[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId)
            .where(and(
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider),
                and(
                    gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                    lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
                )
            ))
            .orderBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday);

        let dateSums: { [date: string]: { cuSum: number, relaySum: number } } = {};

        monthlyData.forEach(item => {
            if (!item.date) {
                throw new Error("Item date is null or undefined");
            }

            if (!dateSums[item.date]) {
                dateSums[item.date] = { cuSum: 0, relaySum: 0 };
            }

            dateSums[item.date].cuSum += Number(item.cuSum);
            dateSums[item.date].relaySum += Number(item.relaySum);

            formatedData.push({
                date: DateToISOString(item.date),
                cus: item.cuSum,
                relays: item.relaySum,
                specId: item.specId!
            });
        });

        Object.keys(dateSums).forEach(date => {
            formatedData.push({
                date: DateToISOString(date),
                cus: dateSums[date].cuSum,
                relays: dateSums[date].relaySum,
                specId: "All Specs"
            });
        });

        return formatedData;
    }

    private combineData(providerMainChartData: ProviderCuRelayData[], providerQosData: ProviderQosData[]): ProviderChartResponse[] {
        const groupedData: { [key: string]: ProviderChartCuRelay[] } = {};

        providerMainChartData.forEach(item => {
            const dateKey = DateToISOString(item.date);
            if (!groupedData[dateKey]) {
                groupedData[dateKey] = [];
            }
            groupedData[dateKey].push({
                specId: item.specId,
                cus: item.cus,
                relays: item.relays
            });
        });

        const result = providerQosData.map(qosItem => ({
            ...qosItem,
            data: groupedData[DateToISOString(qosItem.date)] || []
        }));

        return result;
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<ProviderChartResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const providerMainChartData = await this.getSpecRelayCuChartWithTopProviders(from, to);
        if (GetDataLength(providerMainChartData) === 0) {
            return [];
        }
        const providerQosData = await this.getProviderQosData(from, to);
        const providerCombinedData = this.combineData(providerMainChartData, providerQosData);

        return providerCombinedData;
    }

}

export async function ProviderChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let provider = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (provider === '') {
        return reply;
    }

    let ret: { data: ProviderChartResponse[] } | null = await ProviderChartsData.GetInstance(provider).DateRangeRequestHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    let formattedData: ProviderChartResponse[] = FormatDateItems<ProviderChartResponse>(ret.data);

    return reply.send({ data: formattedData });
}