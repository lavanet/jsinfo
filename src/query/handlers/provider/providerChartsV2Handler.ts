// src/query/handlers/ProviderChartsV2Handler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';

import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt, and, lt, desc, eq } from "drizzle-orm";
import { DateToISOString } from '@jsinfo/utils/date';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { GetAndValidateProviderAddressFromRequest, GetAndValidateSpecIdFromRequestWithAll } from '@jsinfo/query/utils/queryRequestArgParser';
import { PgColumn } from 'drizzle-orm/pg-core';
import { logger } from '@jsinfo/utils/logger';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { queryJsinfo } from '@jsinfo/utils/db';

type ProviderChartDataPoint = {
    date: string;
    qos: number;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
    cus: number;
    relays: number;
};

type ProviderChartsV2Response = {
    provider: string;
    selectedChain: string;
    allAvailableSpecs: string[];
    chartData: ProviderChartDataPoint[];
};

export const ProviderChartsV2RawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    provider: { type: 'string' },
                    selectedChain: { type: 'string' },
                    allAvailableSpecs: {
                        type: 'array',
                        items: { type: 'string' }
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
                    }
                }
            }
        }
    }
};

class ProviderChartsV2Data extends RequestHandlerBase<ProviderChartsV2Response> {
    private provider: string;
    private chain: string;

    constructor(provider: string, chain: string) {
        super("ProviderChartsV2Data");
        this.provider = provider;
        this.chain = chain;
    }

    public static GetInstance(provider: string, chain: string): ProviderChartsV2Data {
        return ProviderChartsV2Data.GetInstanceBase(provider, chain);
    }

    private async getAllAvailableSpecs(): Promise<string[]> {
        const cacheKey = `provider-specs-chart-v2:${this.provider}`;

        try {
            const cachedSpecs = await RedisCache.getArray(cacheKey);
            if (cachedSpecs) {
                logger.info('Retrieved specs from cache', { provider: this.provider, chain: this.chain });
                return cachedSpecs;
            }

            const query = queryJsinfo(db => db.select({ specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId })
                .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .where(eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider))
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                `ProviderChartsV2Data::getAllAvailableSpecs_${this.provider}`
            );

            const specs = await query;
            const result = ['all', ...specs.filter(s => s.specId !== null).map(s => s.specId!)];

            await RedisCache.setArray(cacheKey, result, 1200); // 20 minutes

            return result;
        } catch (error) {
            logger.error('Error in getAllAvailableSpecs', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                context: { provider: this.provider, chain: this.chain }
            });
            throw error;
        }
    }

    private async getProviderData(from: Date, to: Date): Promise<ProviderChartDataPoint[]> {
        try {
            const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

            let conditions = and(
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
            );

            if (this.chain !== 'all') {
                conditions = and(conditions, eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.chain));
            }

            let query = queryJsinfo(db => db.select({
                date: JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday,
                qosSyncAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosSyncAvg),
                qosAvailabilityAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosAvailabilityAvg),
                qosLatencyAvg: qosMetricWeightedAvg(JsinfoProviderAgrSchema.aggDailyRelayPayments.qosLatencyAvg),
                cus: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
                relays: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
            }).from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)
                .where(conditions)
                .orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)),
                `ProviderChartsV2Data::getProviderData_${from}_${to}_${this.provider}_${this.chain}`
            );

            let data = await query;

            if (data.length === 0) {
                logger.warn(`No data found for provider: ${this.provider}, chain: ${this.chain}, from: ${from.toISOString()}, to: ${to.toISOString()}`);
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
            const errorMessage = `Error in getProviderData:
Error: ${error instanceof Error ? error.message : String(error)}
Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}
Context:
  Provider: ${this.provider}
  Chain: ${this.chain}
  From: ${from.toISOString()}
  To: ${to.toISOString()}`;

            logger.error(errorMessage);
            throw error;
        }
    }

    protected async fetchDateRangeRecords(from: Date, to: Date): Promise<ProviderChartsV2Response[]> {
        try {
            ;

            const chartData = await this.getProviderData(from, to);

            const allAvailableSpecs = await this.getAllAvailableSpecs();

            const response = {
                provider: this.provider,
                selectedChain: this.chain === 'all' ? 'all' : this.chain,
                allAvailableSpecs: allAvailableSpecs,
                chartData: chartData
            };

            logger.info('fetchDateRangeRecords completed successfully');
            return [response];
        } catch (error) {
            const errorMessage = `Error in fetchDateRangeRecords:
Error: ${error instanceof Error ? error.message : String(error)}
Stack: ${error instanceof Error ? error.stack : 'No stack trace available'}
Context:
  Provider: ${this.provider}
  Chain: ${this.chain}
  From: ${from.toISOString()}
  To: ${to.toISOString()}`;

            logger.error(errorMessage);

            throw new Error(`Failed to fetch date range records: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}

export async function ProviderChartsV2RawHandler(request: FastifyRequest, reply: FastifyReply) {
    let provider = await GetAndValidateProviderAddressFromRequest("ProviderChartsV2", request, reply);
    if (provider === '') {
        return reply;
    }

    let chain = await GetAndValidateSpecIdFromRequestWithAll(request, reply);
    if (chain === '') {
        return reply;
    }

    let result = await ProviderChartsV2Data.GetInstance(provider, chain).DateRangeRequestHandler(request, reply);

    if (result === null) {
        return reply;
    }

    let ret = result.data[0];

    return reply.send(ret);
}