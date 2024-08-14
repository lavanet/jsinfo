// src/query/handlers/consumerChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoConsumerAgrSchema from '../../../schemas/jsinfoSchema/consumerRelayPaymentsAgregation';
import { sql, gt, and, lt, desc, eq } from "drizzle-orm";
import { DateToISOString, FormatDateItems } from '../../utils/queryDateUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { GetDataLength } from '../../utils/queryUtils';
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';
import { PgColumn } from 'drizzle-orm/pg-core';
import { JSONStringifySpaced } from '../../../utils/utils';

type ConsumerChartCuRelay = {
    specId: string;
    cus: number;
    relays: number;
};

type ConsumerChartResponse = {
    data: ConsumerChartCuRelay[];
} & ConsumerQosData;

interface ConsumerQosQueryData {
    date: string | null;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

type ConsumerQosData = {
    qos: number;
} & ConsumerQosQueryData;

interface SpecCuRelayQueryData {
    date: string | null;
    cuSum: number;
    relaySum: number;
}

type ConsumerCuRelayQueryDataWithSpecId = {
    specId: string | null;
} & SpecCuRelayQueryData;

interface ConsumerCuRelayData {
    date: string;
    specId: string;
    cus: number;
    relays: number;
}

export const ConsumerChartsRawHandlerOpts: RouteShorthandOptions = {
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

class ConsumerChartsData extends RequestHandlerBase<ConsumerChartResponse> {
    private consumer: string;

    constructor(consumer: string) {
        super("ConsumerChartsData");
        this.consumer = consumer;
    }

    public static GetInstance(consumer: string): ConsumerChartsData {
        return ConsumerChartsData.GetInstanceBase(consumer);
    }

    private async getConsumerQosData(from: Date, to: Date): Promise<ConsumerQosData[]> {
        const formatedData: ConsumerQosData[] = [];

        const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum} ELSE 0 END)`;

        let monthlyData: ConsumerQosQueryData[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday,
            qosSyncAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosSyncAvg),
            qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosAvailabilityAvg),
            qosLatencyAvg: qosMetricWeightedAvg(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.qosLatencyAvg),
        }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
            .groupBy(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday)
            .where(and(
                eq(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer, this.consumer),
                and(
                    gt(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, sql<Date>`${from}`),
                    lt(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, sql<Date>`${to}`)
                )))
            .orderBy(desc(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday));

        monthlyData.forEach(item => {
            item.qosSyncAvg = Number(item.qosSyncAvg);
            item.qosAvailabilityAvg = Number(item.qosAvailabilityAvg);
            item.qosLatencyAvg = Number(item.qosLatencyAvg);

            if (!item.date || isNaN(Date.parse(item.date))) {
                throw new Error(`Data format does not match the ConsumerQosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.date is not a valid date.`);
            } else if (isNaN(item.qosSyncAvg)) {
                throw new Error(`Data format does not match the ConsumerQosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosSyncAvg is not a number.`);
            } else if (isNaN(item.qosAvailabilityAvg)) {
                throw new Error(`Data format does not match the ConsumerQosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosAvailabilityAvg is not a number.`);
            } else if (isNaN(item.qosLatencyAvg)) {
                throw new Error(`Data format does not match the ConsumerQosQueryData interface.Item: ${JSONStringifySpaced(item)}.Reason: item.qosLatencyAvg is not a number.`);
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

    private async getSpecRelayCuChartWithTopConsumers(from: Date, to: Date): Promise<ConsumerCuRelayData[]> {
        const formatedData: ConsumerCuRelayData[] = [];

        let monthlyData: ConsumerCuRelayQueryDataWithSpecId[] = await QueryGetJsinfoReadDbInstance().select({
            date: JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday,
            specId: JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId,
            cuSum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.cuSum})`,
            relaySum: sql<number>`SUM(${JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.relaySum})`,
        }).from(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments)
            .groupBy(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.specId)
            .where(and(
                eq(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.consumer, this.consumer),
                and(
                    gt(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, sql<Date>`${from}`),
                    lt(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday, sql<Date>`${to}`)
                )
            ))
            .orderBy(JsinfoConsumerAgrSchema.aggConsumerDailyRelayPayments.dateday);

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

    private combineData(consumerMainChartData: ConsumerCuRelayData[], consumerQosData: ConsumerQosData[]): ConsumerChartResponse[] {
        const groupedData: { [key: string]: ConsumerChartCuRelay[] } = {};

        consumerMainChartData.forEach(item => {
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

        const result = consumerQosData.map(qosItem => ({
            ...qosItem,
            data: groupedData[DateToISOString(qosItem.date)] || []
        }));

        return result;
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<ConsumerChartResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const consumerMainChartData = await this.getSpecRelayCuChartWithTopConsumers(from, to);
        if (GetDataLength(consumerMainChartData) === 0) {
            return [];
        }
        const consumerQosData = await this.getConsumerQosData(from, to);
        const consumerCombinedData = this.combineData(consumerMainChartData, consumerQosData);

        return consumerCombinedData;
    }

}

export async function ConsumerChartsRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let consumer = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (consumer === '') {
        return reply;
    }

    let ret: { data: ConsumerChartResponse[] } | null = await ConsumerChartsData.GetInstance(consumer).DateRangeRequestHandler(request, reply);

    if (ret == null) {
        return reply;
    }

    let formattedData: ConsumerChartResponse[] = FormatDateItems<ConsumerChartResponse>(ret.data);

    return reply.send({ data: formattedData });
}