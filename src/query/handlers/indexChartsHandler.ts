// src/query/handlers/indexChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, gt, and, inArray, lt } from "drizzle-orm";
import { DateToISOString, FormatDateItems } from '../utils/queryDateUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';
import { GetDataLength } from '../utils/queryUtils';
import { PgColumn } from 'drizzle-orm/pg-core';
import { JSONStringifySpaced } from '../../utils/utils';

type CuRelayItem = {
    chainId: string;
    cuSum: number;
    relaySum: number;
};

type IndexChartResponse = {
    date: string;
    qos: number;
    data: CuRelayItem[];
};

interface CuRelayQueryData {
    date: string | null;
    chainId: string | null;
    cuSum: number;
    relaySum: number;
}

interface QosQueryData {
    date: string | Date | null;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

export const IndexChartsRawHandlerOpts: RouteShorthandOptions = {
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
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            chainId: { type: 'string' },
                                            cuSum: { type: 'number' },
                                            relaySum: { type: 'number' },
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

class IndexChartsData extends RequestHandlerBase<IndexChartResponse> {
    private static topChainsCache: string[] | null = null;

    constructor() {
        super("IndexChartsData");
    }

    public static GetInstance(): IndexChartsData {
        return IndexChartsData.GetInstanceBase();
    }

    public async getTopChains(): Promise<string[]> {
        if (IndexChartsData.topChainsCache !== null) {
            return IndexChartsData.topChainsCache;
        }

        let sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        let topChainsQueryRes: { chainId: string | null; }[] = await QueryGetJsinfoReadDbInstance().select({
            chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
            .groupBy(sql`${JsinfoProviderAgrSchema.aggDailyRelayPayments.specId}`)
            .where(gt(sql<Date>`DATE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql<Date>`${sixMonthsAgo}`))
            .orderBy(desc(sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`));

        const topChains: string[] = topChainsQueryRes
            .filter(chain => chain.chainId != null && chain.chainId.trim() !== '')
            .map(chain => chain.chainId as string)
            .slice(0, 10);

        if (topChains.length === 0 || topChainsQueryRes.length === 0) {
            console.warn('getTopChains empty data for topSpecs:: topChains:', topChains, 'topChainsQueryRes:', topChainsQueryRes);
        }

        IndexChartsData.topChainsCache = topChains;
        return topChains;
    }

    private addAllChains(mainChartData: CuRelayQueryData[]): CuRelayQueryData[] {
        const dateSums: Record<string, CuRelayQueryData> = {};

        for (const data of mainChartData) {
            const { date, cuSum, relaySum } = data;

            if (!date) {
                throw new Error('date is null or undefined');
            }

            if (!dateSums[date]) {
                dateSums[date] = { date, chainId: "All Chains", cuSum: 0, relaySum: 0 };
            }

            dateSums[date].cuSum += cuSum;
            dateSums[date].relaySum += relaySum;
        }

        const allChainsData: CuRelayQueryData[] = Object.values(dateSums);
        return [...mainChartData, ...allChainsData];
    }

    private async getMainChartData(topChains: any[], from: Date, to: Date): Promise<CuRelayQueryData[]> {
        let mainChartData: CuRelayQueryData[] = [];

        let monthlyData: CuRelayQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
            cuSum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}, 0))`,
            relaySum: sql<number>`SUM(COALESCE(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}, 0))`,
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
            where(
                and(
                    and(
                        gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                        lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
                    ),
                    inArray(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, topChains)
                )
            ).
            groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday).
            orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

        // Verify and format the data
        monthlyData.forEach(item => {
            item.cuSum = Number(item.cuSum);
            item.relaySum = Number(item.relaySum);

            if (!item.date || isNaN(Date.parse(item.date))) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.date is not a valid date.`);
            } else if (isNaN(item.cuSum)) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.cuSum is not a number.`);
            } else if (isNaN(item.relaySum)) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.relaySum is not a number.`);
            }
        });

        mainChartData = mainChartData.concat(monthlyData);

        this.log(`getMainChartData:: Fetched data from: ${from.toLocaleDateString()} to: ${to.toLocaleDateString()}`);

        return this.addAllChains(mainChartData);
    }

    private async getQosData(from: Date, to: Date): Promise<{ [key: string]: number }> {
        const qosDataFormatted: { [key: string]: number } = {};

        const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

        let monthlyData: QosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
        }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments).
            orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)).
            where(and(
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
            )).
            groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday);

        // Verify and format the data
        monthlyData.forEach(item => {
            item.qosSyncAvg = Number(item.qosSyncAvg);
            item.qosAvailabilityAvg = Number(item.qosAvailabilityAvg);
            item.qosLatencyAvg = Number(item.qosLatencyAvg);

            if (!item.date) {
                throw new Error(`Data format does not match the QosQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.date is not a valid date.`);
            } else if (isNaN(item.qosSyncAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.qosSyncAvg is not a number.`);
            } else if (isNaN(item.qosAvailabilityAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.qosAvailabilityAvg is not a number.`);
            } else if (isNaN(item.qosLatencyAvg)) {
                throw new Error(`Data format does not match the QosQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.qosLatencyAvg is not a number.`);
            }

            const qos = Math.cbrt(item.qosSyncAvg * item.qosAvailabilityAvg * item.qosLatencyAvg);

            qosDataFormatted[DateToISOString(item.date)] = qos;
        });

        this.log(`getQosData:: Fetched data from: ${from.toLocaleDateString()} to: ${to.toLocaleDateString()}`);

        return qosDataFormatted;
    }

    private combineData(mainChartData: CuRelayQueryData[], qosDataFormatted: { [key: string]: number }): IndexChartResponse[] {
        // Group the mainChartData by date
        const groupedData: { [key: string]: CuRelayItem[] } = mainChartData.reduce((acc, item) => {
            const dateKey = DateToISOString(item.date);
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push({
                chainId: item.chainId || '',
                cuSum: item.cuSum,
                relaySum: item.relaySum
            });
            return acc;
        }, {});

        // Merge the groupedData with qosDataFormatted
        return Object.keys(groupedData).map(date => {
            return {
                date: date,
                qos: qosDataFormatted[date] || 0,
                data: groupedData[date]
            };
        });
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<IndexChartResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        const topChains = await this.getTopChains();
        if (GetDataLength(topChains) === 0) {
            return [];
        }

        const mainChartData = await this.getMainChartData(topChains, from, to);
        const qosData = await this.getQosData(from, to);
        const combinedData = this.combineData(mainChartData, qosData);

        return combinedData;
    }
}

export async function IndexChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let ret: { data: IndexChartResponse[] } | null = await IndexChartsData.GetInstance().DateRangeRequestHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    let formattedData: IndexChartResponse[] = FormatDateItems<IndexChartResponse>(ret.data);

    return reply.send({ data: formattedData });
}