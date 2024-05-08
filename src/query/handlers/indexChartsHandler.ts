// src/query/handlers/indexChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, gt, and, inArray } from "drizzle-orm";
import { FormatDateItem } from '../utils/queryDateUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';
import path from 'path';

type CuRelayItem = {
    chainId: string;
    cuSum: number;
    relaySum: number;
};

type IndexChartResponse = {
    date: Date;
    qos: number;
    data: CuRelayItem[];
};

type IndexChartResponseStringDate = {
    date: string;
    qos: number;
    data: CuRelayItem[];
};

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

class IndexChartsData extends CachedDiskDbDataFetcher<IndexChartResponse> {

    constructor() {
        super("IndexChartsData");
    }

    public static GetInstance(): IndexChartsData {
        return IndexChartsData.GetInstanceBase();
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `IndexChartsData`);
    }

    protected async fetchDataFromDb(): Promise<IndexChartResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        //
        // Get top chains
        let topSpecs = await QueryGetJsinfoReadDbInstance().select({
            chainId: JsinfoSchema.aggHourlyrelayPayments.specId,
        }).from(JsinfoSchema.aggHourlyrelayPayments).
            groupBy(sql`${JsinfoSchema.aggHourlyrelayPayments.specId}`).
            where(gt(sql<Date>`DATE(${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '6 month'`)).
            orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`))

        const getChains = topSpecs.map(chain => chain.chainId!).slice(0, 10);

        if (getChains.length === 0 || topSpecs.length === 0) {
            console.log('IndexHandler empty data for topSpecs:: getChains:', getChains, 'topSpecs:', topSpecs);
        }

        //
        // Get graph with 1 day resolution
        let mainChartData = {}
        if (getChains.length != 0) {
            mainChartData = await QueryGetJsinfoReadDbInstance().select({
                date: sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
                chainId: JsinfoSchema.aggHourlyrelayPayments.specId,
                cuSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.cuSum})`,
                relaySum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})`,
            }).from(JsinfoSchema.aggHourlyrelayPayments).
                where(
                    and(
                        gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '6 month'`),
                        inArray(JsinfoSchema.aggHourlyrelayPayments.specId, getChains)
                    )
                ).
                groupBy(sql`${JsinfoSchema.aggHourlyrelayPayments.specId}`, sql`mydate`).
                orderBy(sql`mydate`)
        }

        mainChartData = addAllChains(mainChartData);

        // QoS graph
        let qosDataRaw = await QueryGetJsinfoReadDbInstance().select({
            date: sql`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour}) as mydate`,
            qos: sql<number>`CBRT(
                sum(${JsinfoSchema.aggHourlyrelayPayments.qosSyncAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})
                *
                sum(${JsinfoSchema.aggHourlyrelayPayments.qosAvailabilityAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})
                *
                sum(${JsinfoSchema.aggHourlyrelayPayments.qosLatencyAvg}*${JsinfoSchema.aggHourlyrelayPayments.relaySum})/sum(${JsinfoSchema.aggHourlyrelayPayments.relaySum})
            )`
        }).from(JsinfoSchema.aggHourlyrelayPayments).
            where(gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '6 month'`)).
            groupBy(sql`mydate`).
            orderBy(sql`mydate`)


        const qosDataFormatted: { [key: string]: number } = {};
        qosDataRaw.forEach(item => {
            qosDataFormatted[String(item.date)] = item.qos;
        });

        const combinedData: IndexChartResponse[] = Object.keys(mainChartData).map(date => {
            return {
                date: new Date(date),
                qos: qosDataFormatted[date] || 0,
                data: mainChartData[date]
            };
        });

        return combinedData;
    }

    protected async getItemsByFromToImpl(data: IndexChartResponse[], fromDate: Date, toDate: Date): Promise<IndexChartResponse[] | null> {
        return data.filter(item => {
            return item.date >= fromDate && item.date <= toDate;
        });
    }
}

function addAllChains(mainChartData) {
    const dateSums = {};
    mainChartData.forEach(data => {
        if (!dateSums[data.date]) {
            dateSums[data.date] = { date: data.date, chainId: "All Chains", cuSum: 0, relaySum: 0 };
        }
        dateSums[data.date].cuSum += Number(data.cuSum);
        dateSums[data.date].relaySum += Number(data.relaySum);
    });
    const newChartData = Object.values(dateSums);
    return mainChartData.concat(newChartData);
}

export async function IndexChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    let ret = await IndexChartsData.GetInstance().getItemsByFromToChartsHandler(request, reply);
    if (ret == null) return reply;

    const uniqueYears = new Set(ret.data.map(item => item.date.getFullYear()));

    const addYears = uniqueYears.size > 1;

    let formattedData: IndexChartResponseStringDate[] = ret.data.map(item => {
        return {
            ...item,
            date: FormatDateItem(item.date, addYears)
        };
    });

    return reply.send({ data: formattedData });
}