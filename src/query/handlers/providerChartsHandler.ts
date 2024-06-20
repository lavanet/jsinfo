// src/query/handlers/providerChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, gt, and, lt, eq } from "drizzle-orm";
import { FormatDateItems } from '../utils/queryDateUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';
import path from 'path';
import { GetAndValidateProviderAddressFromRequest, GetDataLength } from '../utils/queryUtils';

type ProviderChartCuRelay = {
    specId: string;
    cus: number;
    relays: number;
};

type ProviderChartResponse = {
    data: ProviderChartCuRelay[];
} & ProviderQosData;

interface ProviderQosQueryData {
    date: string;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

type ProviderQosData = {
    qos: number;
} & ProviderQosQueryData;

interface SpecCuRelayQueryData {
    date: string;
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

class ProviderChartsData extends CachedDiskDbDataFetcher<ProviderChartResponse> {
    private provider: string;

    constructor(provider: string) {
        super("ProviderChartsData");
        this.provider = provider;
    }

    public static GetInstance(provider: string): ProviderChartsData {
        return ProviderChartsData.GetInstanceBase(provider);
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderChartsData_${this.provider}`);
    }

    private async getProviderQosData(): Promise<ProviderQosData[]> {
        let currentDate = new Date();
        let sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 2);

        const formatedData: ProviderQosData[] = [];

        while (currentDate >= sixMonthsAgo) {
            let startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            let endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            let monthlyData: ProviderQosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
                date: sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
                qosSyncAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
                qosAvailabilityAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
                qosLatencyAvg: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
            }).from(JsinfoSchema.aggHourlyrelayPayments).
                where(and(
                    and(
                        gt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`${startDate}`),
                        lt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`${endDate}`)
                    ),
                    eq(JsinfoSchema.aggHourlyrelayPayments.provider, this.provider)
                )).
                groupBy(sql`mydate`).
                orderBy(sql`mydate DESC`);

            // Verify and format the data
            monthlyData.forEach(item => {
                item.qosSyncAvg = Number(item.qosSyncAvg);
                item.qosAvailabilityAvg = Number(item.qosAvailabilityAvg);
                item.qosLatencyAvg = Number(item.qosLatencyAvg);

                if (isNaN(Date.parse(item.date))) {
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
                    date: item.date,
                    qos: qos,
                    qosSyncAvg: item.qosSyncAvg,
                    qosAvailabilityAvg: item.qosAvailabilityAvg,
                    qosLatencyAvg: item.qosLatencyAvg
                });
            });

            this.log(`getProviderQosData:: Fetched data for month: ${currentDate.getMonth() + 1}/${currentDate.getFullYear()} `);
            currentDate.setMonth(currentDate.getMonth() - 1);
        }

        return formatedData;
    }

    private async getSpecRelayCuChartWithTopProviders(): Promise<ProviderCuRelayData[]> {
        let currentDate = new Date();
        let sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 2);

        const formatedData: ProviderCuRelayData[] = [];

        while (currentDate >= sixMonthsAgo) {
            let startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            let endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            let monthlyData: ProviderCuRelayQueryDataWithSpecId[] = await QueryGetJsinfoReadDbInstance().select({
                date: sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
                cuSum: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.cuSum}, 0), 0))`,
                relaySum: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.relaySum}, 0), 0))`,
                specId: JsinfoSchema.aggHourlyrelayPayments.specId,
            }).from(JsinfoSchema.aggHourlyrelayPayments).
                groupBy(sql`mydate`, JsinfoSchema.aggHourlyrelayPayments.specId).
                where(and(
                    and(
                        gt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`${startDate}`),
                        lt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`${endDate}`)
                    ),
                    and(
                        eq(JsinfoSchema.aggHourlyrelayPayments.provider, this.provider),
                    )
                )).orderBy(sql`mydate DESC`);

            let dateSums: { [date: string]: { cuSum: number, relaySum: number } } = {};

            monthlyData.forEach(item => {
                if (!dateSums[item.date]) {
                    dateSums[item.date] = { cuSum: 0, relaySum: 0 };
                }

                dateSums[item.date].cuSum += Number(item.cuSum);
                dateSums[item.date].relaySum += Number(item.relaySum);

                formatedData.push({
                    date: item.date,
                    cus: item.cuSum,
                    relays: item.relaySum,
                    specId: item.specId!
                });
            });

            Object.keys(dateSums).forEach(date => {
                formatedData.push({
                    date: date,
                    cus: dateSums[date].cuSum,
                    relays: dateSums[date].relaySum,
                    specId: "All Specs"
                });
            });

            currentDate.setMonth(currentDate.getMonth() - 1);
        }

        return formatedData;
    }

    private combineData(providerMainChartData: ProviderCuRelayData[], providerQosData: ProviderQosData[]): ProviderChartResponse[] {
        // Group the providerMainChartData by date
        const groupedData: { [key: string]: ProviderChartCuRelay[] } = providerMainChartData.reduce((acc, item) => {
            if (!acc[item.date]) {
                acc[item.date] = [];
            }
            acc[item.date].push({
                specId: item.specId,
                cus: item.cus,
                relays: item.relays
            });
            return acc;
        }, {});

        // Merge the providerQosData with groupedData
        return providerQosData.map(providerQosData => {
            return {
                ...providerQosData,
                data: groupedData[providerQosData.date] || []
            };
        });
    }

    protected async fetchDataFromDb(): Promise<ProviderChartResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        const providerMainChartData = await this.getSpecRelayCuChartWithTopProviders();
        if (GetDataLength(providerMainChartData) === 0) {
            this.setDataIsEmpty();
            return [];
        }
        const providerQosData = await this.getProviderQosData();
        const providerCombinedData = this.combineData(providerMainChartData, providerQosData);

        return providerCombinedData;
    }

    protected async getItemsByFromToImpl(data: ProviderChartResponse[], fromDate: Date, toDate: Date): Promise<ProviderChartResponse[] | null> {

        const filteredData = data.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= fromDate && itemDate <= toDate;
        });

        return filteredData;
    }
}

export async function ProviderChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let provider = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (provider === '') {
        return reply;
    }

    let ret: { data: ProviderChartResponse[] } | null = await ProviderChartsData.GetInstance(provider).getItemsByFromToChartsHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    let formattedData: ProviderChartResponse[] = FormatDateItems<ProviderChartResponse>(ret.data);

    return reply.send({ data: formattedData });
}