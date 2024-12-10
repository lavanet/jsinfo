import { sql, desc, gt, and, inArray, lt } from "drizzle-orm";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { PgColumn } from 'drizzle-orm/pg-core';
import { DateToDayDateString, NormalizeChartFetchDates } from '@jsinfo/utils/date';
import { IndexTopChainsResource } from './IndexTopChainsResource';
import { JSONStringifySpaced } from '@jsinfo/utils/fmt';
import { queryJsinfo } from "@jsinfo/utils/db";

interface CuRelayQueryData {
    date: string | null;
    chainId: string | null;
    cuSum: number;
    relaySum: number;
}

interface QosQueryData {
    date: string | null;
    qosSyncAvg: number;
    qosAvailabilityAvg: number;
    qosLatencyAvg: number;
}

export interface CuRelayItem {
    chainId: string;
    cuSum: number;
    relaySum: number;
}

export interface IndexChartResponse {
    date: string;
    qos: number;
    data: CuRelayItem[];
}

interface QueryParams {
    from: Date;
    to: Date;
}

export class IndexChartsResource extends RedisResourceBase<IndexChartResponse[], QueryParams> {
    protected readonly redisKey = 'index:charts';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    protected getRedisKey(params: QueryParams = this.getDefaultParams()): string {
        return `${this.redisKey}:${params.from.getTime()}:${params.to.getTime()}`;
    }

    protected async fetchFromSource(params?: QueryParams): Promise<IndexChartResponse[]> {
        // Use default params if none provided
        const queryParams = params || this.getDefaultParams();
        const { from, to } = NormalizeChartFetchDates(queryParams.from, queryParams.to);

        const topChainsResource = new IndexTopChainsResource();
        const topChainsResult = await topChainsResource.fetch();
        if (!topChainsResult || topChainsResult.allSpecs.length === 0) {
            console.warn('IndexChartsResource: No top chains found');
            return [];
        }

        const topChains = topChainsResult.allSpecs.map(spec => spec.chainId);

        const [mainChartData, qosData] = await Promise.all([
            this.getMainChartData(topChains, from, to),
            this.getQosData(from, to)
        ]);

        return this.combineData(mainChartData, qosData);
    }

    private getDefaultParams(): QueryParams {
        const to = new Date();
        const from = new Date(to);
        from.setDate(from.getDate() - 90);

        return {
            from,
            to
        };
    }

    private async getMainChartData(topChains: string[], from: Date, to: Date): Promise<CuRelayQueryData[]> {
        const monthlyData = await queryJsinfo(db => db.select({
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
            orderBy(desc(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday)),
            `IndexChartsResource::getMainChartData_${from}_${to}`
        );

        // Verify and format the data
        monthlyData.forEach(item => {
            item.cuSum = Number(item.cuSum);
            item.relaySum = Number(item.relaySum);

            if (!item.date) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.date is not a valid date.`);
            } else if (isNaN(item.cuSum)) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.cuSum is not a number.`);
            } else if (isNaN(item.relaySum)) {
                throw new Error(`Data format does not match the CuRelayQueryData interface. Item: ${JSONStringifySpaced(item)}. Reason: item.relaySum is not a number.`);
            }
        });

        return this.addAllChains(monthlyData);
    }

    private async getQosData(from: Date, to: Date): Promise<{ [key: string]: number }> {
        const qosMetricWeightedAvg = (metric: PgColumn) =>
            sql<number>`SUM(${metric} * ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}) / 
            SUM(CASE WHEN ${metric} IS NOT NULL THEN ${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum} ELSE 0 END)`;

        const monthlyData = await queryJsinfo(db => db.select({
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
            groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday),
            `IndexChartsResource::getQosData_${from}_${to}`
        );

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
        });

        return this.formatQosData(monthlyData);
    }

    private addAllChains(data: CuRelayQueryData[]): CuRelayQueryData[] {
        const dateSums: Record<string, CuRelayQueryData> = {};

        data.forEach((item) => {
            if (!item.date) return;

            const dateStr = DateToDayDateString(item.date);
            if (!dateSums[dateStr]) {
                dateSums[dateStr] = {
                    date: item.date,
                    chainId: 'All Chains',
                    cuSum: 0,
                    relaySum: 0
                };
            }

            dateSums[dateStr].cuSum += item.cuSum;
            dateSums[dateStr].relaySum += item.relaySum;
        });

        return [...data, ...Object.values(dateSums)];
    }

    private formatQosData(data: QosQueryData[]): { [key: string]: number } {
        const formatted: { [key: string]: number } = {};

        data.forEach((item) => {
            if (!item.date) return;

            const qos = Math.cbrt(
                item.qosSyncAvg *
                item.qosAvailabilityAvg *
                item.qosLatencyAvg
            );

            formatted[DateToDayDateString(item.date)] = qos;
        });

        return formatted;
    }

    private combineData(mainChartData: CuRelayQueryData[], qosData: { [key: string]: number }): IndexChartResponse[] {
        const groupedData: Record<string, CuRelayItem[]> = {};

        mainChartData.forEach((item) => {
            if (!item.date || !item.chainId) return;

            const dateStr = DateToDayDateString(item.date);
            if (!groupedData[dateStr]) {
                groupedData[dateStr] = [];
            }

            groupedData[dateStr].push({
                chainId: item.chainId,
                cuSum: item.cuSum,
                relaySum: item.relaySum
            });
        });

        return Object.entries(groupedData).map(([date, data]) => ({
            date,
            qos: qosData[date] || 0,
            data
        }));
    }
} 