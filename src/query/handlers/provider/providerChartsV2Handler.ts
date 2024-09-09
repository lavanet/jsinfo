// src/query/handlers/ProviderChartsV2Handler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, gt, and, lt, desc, eq } from "drizzle-orm";
import { DateToISOString, FormatDateItems } from '../../utils/queryDateUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { GetAndValidateProviderAddressFromRequest, GetAndValidateSpecIdFromRequestWithAll } from '../../utils/queryRequestArgParser';
import { PgColumn } from 'drizzle-orm/pg-core';
import { logger } from '../../../utils/utils';

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
        logger.info('Starting getAllAvailableSpecs', { provider: this.provider });
        try {
            const specs = await QueryGetJsinfoReadDbInstance()
                .selectDistinct({ specId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId })
                .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .where(eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider));

            logger.info('getAllAvailableSpecs completed successfully', { specsLength: specs.length });
            return ['all', ...specs.filter(s => s.specId !== null).map(s => s.specId!)];
        } catch (error) {
            logger.error('Error in getAllAvailableSpecs', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : 'No stack trace available',
                context: { provider: this.provider }
            });
            throw error;
        }
    }

    private async getProviderData(from: Date, to: Date): Promise<ProviderChartDataPoint[]> {
        logger.info(`Starting getProviderData for provider: ${this.provider}, chain: ${this.chain}, from: ${from.toISOString()}, to: ${to.toISOString()}`);
        try {
            const formattedData: ProviderChartDataPoint[] = [];

            const qosMetricWeightedAvg = (metric: PgColumn) => sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

            let conditions = and(
                eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.provider, this.provider),
                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${from}`),
                lt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`${to}`)
            );

            if (this.chain !== 'all') {
                conditions = and(conditions, eq(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId, this.chain));
            }

            let query = QueryGetJsinfoReadDbInstance().select({
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

            logger.info(`SQL Query: ${query.toSQL().sql}`);
            logger.info(`SQL Params: ${JSON.stringify(query.toSQL().params)}`);

            let data = await query;

            logger.info(`Raw data returned: ${JSON.stringify(data)}`);

            if (data.length === 0) {
                logger.warn(`No data found for provider: ${this.provider}, chain: ${this.chain}, from: ${from.toISOString()}, to: ${to.toISOString()}`);
            }

            logger.info('getProviderData completed successfully', { dataLength: formattedData.length });
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
            logger.info('Starting fetchDateRangeRecords', { provider: this.provider, chain: this.chain, from, to });

            await QueryCheckJsinfoReadDbInstance();
            logger.info('QueryCheckJsinfoReadDbInstance completed');

            const chartData = await this.getProviderData(from, to);
            logger.info('getProviderData completed', { dataLength: chartData.length });

            const allAvailableSpecs = await this.getAllAvailableSpecs();
            logger.info('getAllAvailableSpecs completed', { specsLength: allAvailableSpecs.length });

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
    console.log("chain", chain);
    if (chain === '') {
        return reply;
    }

    let result = await ProviderChartsV2Data.GetInstance(provider, chain).DateRangeRequestHandler(request, reply);

    if (result === null) {
        return reply;
    }

    let ret = result.data[0];
    ret.chartData = FormatDateItems<ProviderChartDataPoint>(ret.chartData);

    logger.info(`ProviderChartsV2RawHandler result: ${JSON.stringify(ret)}`);

    return reply.send(ret);
}