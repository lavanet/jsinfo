// src/query/handlers/spec/specChartsV2Handler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt, and, lt, desc, eq } from "drizzle-orm";
import { DateToISOString } from '../../utils/queryDateUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { GetAndValidateSpecIdFromRequest, GetAndValidateProviderAddressFromRequestWithAll } from '../../utils/queryRequestArgParser';
import { PgColumn } from 'drizzle-orm/pg-core';
import { logger } from '../../../utils/utils';
import { RedisCache } from '../../classes/RedisCache';
import { MonikerCache } from '../../classes/QueryProviderMonikerCache';

type SpecChartDataPoint = {
    date: string;
    qos: number;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
    cus: number;
    relays: number;
};

type SpecChartsV2Response = {
    spec: string;
    selectedProvider: string;
    allAvailableProviders: { [key: string]: string };
    chartData: SpecChartDataPoint[];
    totalItemCount: number;
};

export const SpecChartsV2RawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    spec: { type: 'string' },
                    selectedProvider: { type: 'string' },
                    allAvailableProviders: {
                        type: 'object',
                        additionalProperties: { type: 'string' }
                    },
                    chartData: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                qos: { type: 'number' },
                                qosSyncAvg: { type: 'number' },
                                qosAvailabilityAvg: { type: 'number' },
                                qosLatencyAvg: { type: 'number' },
                                cus: { type: 'number' },
                                relays: { type: 'number' }
                            }
                        }
                    },
                    totalItemCount: { type: 'number' }
                }
            }
        }
    }
};

class SpecChartsV2Data extends RequestHandlerBase<SpecChartsV2Response> {
    private spec: string;
    private provider: string;

    constructor(spec: string, provider: string) {
        super("SpecChartsV2Data");
        this.spec = spec;
        this.provider = provider;
    }

    public static GetInstance(spec: string, provider: string): SpecChartsV2Data {
        return SpecChartsV2Data.GetInstanceBase(spec, provider);
    }

    private async getAllAvailableProviders(): Promise<{ [key: string]: string }> {
        const cacheKey = `spec-providers-chart-v2:${this.spec}`;

        try {
            const cachedProviders = await RedisCache.getDict(cacheKey);
            if (cachedProviders) {
                logger.info('Retrieved providers from cache', { spec: this.spec });
                return cachedProviders;
            }

            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const query = QueryGetJsinfoDbForQueryInstance()
                .select({
                    provider: JsinfoProviderAgrSchema.aggDailyRelayPayments.provider,
                    latestDate: sql<Date>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`
                })
                .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .where(eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.spec))
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider)
                .having(gt(sql<Date>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sixMonthsAgo));

            const providers = await query;
            const result: { [key: string]: string } = { 'all': 'All Providers' };

            for (const p of providers) {
                if (p.provider) {
                    const moniker = await MonikerCache.GetMonikerForProvider(p.provider);
                    result[p.provider] = moniker || p.provider;
                }
            }

            await RedisCache.setDict(cacheKey, result, 1200); // 20 minutes

            return result;
        } catch (error) {
            logger.error('Error in getAllAvailableProviders', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                context: { spec: this.spec }
            });
            throw error;
        }
    }

    private async getSpecData(from: Date, to: Date): Promise<SpecChartDataPoint[]> {
        try {
            const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

            let conditions = and(
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.spec),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
            );

            if (this.provider !== 'all') {
                conditions = and(conditions, eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider));
            }

            let query = QueryGetJsinfoDbForQueryInstance().select({
                date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
                qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
                qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
                qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
                cus: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
                relays: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
            }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
                .where(conditions)
                .orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday));

            let data = await query;

            if (data.length === 0) {
                logger.warn(`No data found for spec: ${this.spec}, provider: ${this.provider}, from: ${from.toISOString()}, to: ${to.toISOString()}`);
            }

            return data.map(item => ({
                date: DateToISOString(item.date),
                qos: Math.cbrt(Number(item.qosSyncAvg) * Number(item.qosAvailabilityAvg) * Number(item.qosLatencyAvg)),
                qosSyncAvg: Number(item.qosSyncAvg),
                qosAvailabilityAvg: Number(item.qosAvailabilityAvg),
                qosLatencyAvg: Number(item.qosLatencyAvg),
                cus: Number(item.cus),
                relays: Number(item.relays)
            }));
        } catch (error) {
            const errorMessage = `Error in getSpecData:
Error: ${error instanceof Error ? error.message : String(error)}
Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}
Context:
  Spec: ${this.spec}
  Provider: ${this.provider}
  From: ${from.toISOString()}
  To: ${to.toISOString()}`;

            logger.error(errorMessage);
            throw error;
        }
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<SpecChartsV2Response[]> {
        try {
            await QueryCheckJsinfoDbInstance();

            const chartData = await this.getSpecData(from, to);

            const allAvailableProviders = await this.getAllAvailableProviders();

            const response: SpecChartsV2Response = {
                spec: this.spec,
                selectedProvider: this.provider,
                allAvailableProviders: allAvailableProviders,
                chartData: chartData,
                totalItemCount: chartData.length
            };

            logger.info('fetchDateRangeRecords completed successfully');
            return [response];
        } catch (error) {
            const errorMessage = `Error in fetchDateRangeRecords:
Error: ${error instanceof Error ? error.message : String(error)}
Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}
Context:
  Spec: ${this.spec}
  Provider: ${this.provider}
  From: ${from.toISOString()}
  To: ${to.toISOString()}`;

            logger.error(errorMessage);

            throw new Error(`Failed to fetch date range records: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export async function SpecChartsV2RawHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    let provider = await GetAndValidateProviderAddressFromRequestWithAll('SpecChartsV2RawHandler', request, reply);
    if (provider === '') {
        return reply;
    }

    let result = await SpecChartsV2Data.GetInstance(spec, provider).DateRangeRequestHandler(request, reply);

    if (result === null) {
        return reply;
    }

    let ret = result.data[0];

    return reply.send(ret);
}