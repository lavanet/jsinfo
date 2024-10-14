// src/query/handlers/indexChartsV3Handler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';

import { sql, desc, gt, and, inArray, lt } from "drizzle-orm";
import { DateToDayDateString } from '../../utils/queryDateUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { JSONStringifySpaced } from '../../../utils/utils';

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

interface IndexChartMergedData {
    date: string;
    qos: number;
    data: CuRelayItem[];
}

export const IndexChartsV3RawHandlerOpts: RouteShorthandOptions = {
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

class IndexChartsV3Data extends RequestHandlerBase<IndexChartResponse> {
    private static topChainsCache: string[] | null = null;

    constructor() {
        super("IndexChartsV3Data");
    }

    public static GetInstance(): IndexChartsV3Data {
        return IndexChartsV3Data.GetInstanceBase();
    }

    public async getTopChains(): Promise<string[]> {
        if (IndexChartsV3Data.topChainsCache !== null) {
            return IndexChartsV3Data.topChainsCache;
        }

        let sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        let topChainsQueryRes: { chainId: string | null; }[] = await QueryGetJsinfoReadDbInstance().select({
            chainId: sql<string>`spec_id`,
        }).from(sql`agg_15min_provider_relay_payments`)
            .groupBy(sql`spec_id`)
            .where(gt(sql<Date>`DATE(bucket_15min)`, sql<Date>`${sixMonthsAgo}`))
            .orderBy(desc(sql<number>`SUM(relaysum)`));

        const topChains: string[] = topChainsQueryRes
            .filter(chain => chain.chainId != null && chain.chainId.trim() !== '')
            .map(chain => chain.chainId as string)
            .slice(0, 10);

        if (topChains.length === 0 || topChainsQueryRes.length === 0) {
            console.warn('getTopChains empty data for topSpecs:: topChains:', topChains, 'topChainsQueryRes:', topChainsQueryRes);
        }

        IndexChartsV3Data.topChainsCache = topChains;
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
            date: sql<string>`DATE(bucket_15min)`,
            chainId: sql<string>`spec_id`,
            cuSum: sql<number>`SUM(COALESCE(cusum, 0))`,
            relaySum: sql<number>`SUM(COALESCE(relaysum, 0))`,
        }).from(sql`agg_15min_provider_relay_payments`)
            .where(
                and(
                    and(
                        gt(sql`bucket_15min`, sql<Date>`${from}`),
                        lt(sql`bucket_15min`, sql<Date>`${to}`)
                    ),
                    inArray(sql`spec_id`, topChains)
                )
            )
            .groupBy(sql`spec_id, DATE(bucket_15min)`)
            .orderBy(desc(sql`DATE(bucket_15min)`));

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

        const qosMetricWeightedAvg = (metric: string) => sql<number>`SUM(${sql.raw(metric)} * relaysum) / SUM(CASE WHEN ${sql.raw(metric)} IS NOT NULL THEN relaysum ELSE 0 END)`;

        let monthlyData: QosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: sql<string>`DATE(bucket_15min)`,
            qosSyncAvg: qosMetricWeightedAvg('qossyncavg'),
            qosAvailabilityAvg: qosMetricWeightedAvg('qosavailabilityavg'),
            qosLatencyAvg: qosMetricWeightedAvg('qoslatencyavg'),
        }).from(sql`agg_15min_provider_relay_payments`)
            .orderBy(desc(sql`DATE(bucket_15min)`))
            .where(and(
                gt(sql`bucket_15min`, sql<Date>`${from}`),
                lt(sql`bucket_15min`, sql<Date>`${to}`)
            ))
            .groupBy(sql`DATE(bucket_15min)`);

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

            qosDataFormatted[DateToDayDateString(item.date)] = qos;
        });

        this.log(`getQosData:: Fetched data from: ${from.toLocaleDateString()} to: ${to.toLocaleDateString()}`);

        return qosDataFormatted;
    }

    private combineData(mainChartData: CuRelayQueryData[], qosDataFormatted: { [key: string]: number }): IndexChartResponse[] {
        // Group the mainChartData by date
        const groupedData: { [key: string]: CuRelayItem[] } = mainChartData.reduce((acc, item) => {
            const dateKey = DateToDayDateString(item.date);
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
        const mergedData: IndexChartMergedData[] = Object.keys(groupedData).map(date => {
            return {
                date: date,
                qos: qosDataFormatted[date] || 0,
                data: groupedData[date]
            };
        });

        return mergedData;
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

export async function IndexChartsV3RawHandler(request: FastifyRequest, reply: FastifyReply) {
    let ret: { data: IndexChartResponse[] } | null = await IndexChartsV3Data.GetInstance().DateRangeRequestHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    // let formattedData: IndexChartResponse[] = FormatDateItems<IndexChartResponse>(ret.data);

    return reply.send({ data: ret.data });
}