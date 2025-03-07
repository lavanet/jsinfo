// src/query/handlers/eventsRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { queryJsinfo } from '@jsinfo/utils/db';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';

export interface EventsRewardsResponse {
    id: number | null;
    relays: number | null;
    cu: number | null;
    pay: string | null;
    datetime: Date | null;
    qosSync: number | null;
    qosAvailability: number | null;
    qosLatency: number | null;
    qosSyncExc: number | null;
    qosAvailabilityExc: number | null;
    qosLatencyExc: number | null;
    provider: string | null;
    moniker: string | null;
    monikerfull: string | null;
    specId: string | null;
    blockId: number | null;
    consumer: string | null;
    tx: string | null;
}

export const EventsRewardsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                id: { type: ['number', 'null'] },
                                relays: { type: ['number', 'null'] },
                                cu: { type: ['number', 'null'] },
                                pay: { type: ['number', 'null'] },
                                datetime: { type: ['string', 'null'] },
                                qosSync: { type: ['number', 'null'] },
                                qosAvailability: { type: ['number', 'null'] },
                                qosLatency: { type: ['number', 'null'] },
                                qosSyncExc: { type: ['number', 'null'] },
                                qosAvailabilityExc: { type: ['number', 'null'] },
                                qosLatencyExc: { type: ['number', 'null'] },
                                provider: { type: ['string', 'null'] },
                                moniker: { type: ['string', 'null'] },
                                monikerfull: { type: ['string', 'null'] },
                                specId: { type: ['string', 'null'] },
                                blockId: { type: ['number', 'null'] },
                                consumer: { type: ['string', 'null'] },
                                tx: { type: ['string', 'null'] },
                            }
                        }
                    }
                }
            }
        }
    }
};


class EventsRewardsData extends RequestHandlerBase<EventsRewardsResponse> {

    constructor() {
        super("EventsRewardsData");
    }

    public static GetInstance(): EventsRewardsData {
        return EventsRewardsData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `EventsRewards.csv`;
    }

    protected async fetchAllRecords(): Promise<EventsRewardsResponse[]> {
        const paymentsRes = await queryJsinfo(
            async (db) => await db.select()
                .from(JsinfoSchema.relayPayments)
                .orderBy(desc(JsinfoSchema.relayPayments.id))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            'EventsRewardsData_fetchAllRecords'
        );

        const flattenedRes = await Promise.all(paymentsRes.map(async data => ({
            ...data,
            pay: data.pay?.toString() || null,
            moniker: await ProviderMonikerService.GetMonikerForProvider(data.provider),
            monikerfull: await ProviderMonikerService.GetMonikerFullDescription(data.provider),
        })));

        return flattenedRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        const countResult = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)::int`
            })
                .from(JsinfoSchema.relayPayments),
            'EventsRewardsData_fetchRecordCountFromDb'
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<EventsRewardsResponse[]> {
        const defaultSortKey = "id";
        let finalPagination: Pagination;

        if (pagination) {
            finalPagination = pagination;
        } else {
            finalPagination = ParsePaginationFromString(
                `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
            );
        }

        // If sortKey is null, set it to the defaultSortKey
        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        const keyToColumnMap = {
            id: JsinfoSchema.relayPayments.id,
            provider: JsinfoSchema.relayPayments.provider,
            moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker})`,
            relays: JsinfoSchema.relayPayments.relays,
            cu: JsinfoSchema.relayPayments.cu,
            pay: JsinfoSchema.relayPayments.pay,
            datetime: JsinfoSchema.relayPayments.datetime,
            qosSync: JsinfoSchema.relayPayments.qosSync,
            qosAvailability: JsinfoSchema.relayPayments.qosAvailability,
            qosLatency: JsinfoSchema.relayPayments.qosLatency,
            qosSyncExc: JsinfoSchema.relayPayments.qosSyncExc,
            qosAvailabilityExc: JsinfoSchema.relayPayments.qosAvailabilityExc,
            qosLatencyExc: JsinfoSchema.relayPayments.qosLatencyExc,
            specId: JsinfoSchema.relayPayments.specId,
            blockId: JsinfoSchema.relayPayments.blockId,
            consumer: JsinfoSchema.relayPayments.consumer,
            tx: JsinfoSchema.relayPayments.tx
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        const sortColumn = keyToColumnMap[finalPagination.sortKey];

        const paymentsRes = await queryJsinfo(
            async (db) => {
                return await db.select({
                    id: JsinfoSchema.relayPayments.id,
                    provider: JsinfoSchema.relayPayments.provider,
                    relays: JsinfoSchema.relayPayments.relays,
                    cu: JsinfoSchema.relayPayments.cu,
                    pay: JsinfoSchema.relayPayments.pay,
                    datetime: JsinfoSchema.relayPayments.datetime,
                    qosSync: JsinfoSchema.relayPayments.qosSync,
                    qosAvailability: JsinfoSchema.relayPayments.qosAvailability,
                    qosLatency: JsinfoSchema.relayPayments.qosLatency,
                    qosSyncExc: JsinfoSchema.relayPayments.qosSyncExc,
                    qosAvailabilityExc: JsinfoSchema.relayPayments.qosAvailabilityExc,
                    qosLatencyExc: JsinfoSchema.relayPayments.qosLatencyExc,
                    specId: JsinfoSchema.relayPayments.specId,
                    blockId: JsinfoSchema.relayPayments.blockId,
                    consumer: JsinfoSchema.relayPayments.consumer,
                    tx: JsinfoSchema.relayPayments.tx,
                    moniker: sql<string>`MAX(${JsinfoSchema.providerSpecMoniker.moniker})`
                })
                    .from(JsinfoSchema.relayPayments)
                    .leftJoin(
                        JsinfoSchema.providerSpecMoniker,
                        eq(JsinfoSchema.relayPayments.provider, JsinfoSchema.providerSpecMoniker.provider)
                    )
                    .groupBy(JsinfoSchema.relayPayments.id)
                    .orderBy(finalPagination.direction === 'ascending' ? asc(sortColumn) : desc(sortColumn))
                    .offset((finalPagination.page - 1) * finalPagination.count)
                    .limit(finalPagination.count);
            },
            `EventsRewardsData_fetchPaginatedRecords_withMoniker_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
        );

        const flattenedRewards = await Promise.all(paymentsRes.map(async data => ({
            ...data,
            pay: data.pay?.toString() || null,
            moniker: await ProviderMonikerService.GetMonikerForProvider(data.provider),
            monikerfull: await ProviderMonikerService.GetMonikerFullDescription(data.provider),
        })));

        return flattenedRewards;
    }

    public async ConvertRecordsToCsv(data: EventsRewardsResponse[]): Promise<string> {
        const columns = [
            { key: "relays", name: "Relays" },
            { key: "cu", name: "CU" },
            { key: "pay", name: "Pay" },
            { key: "datetime", name: "Datetime" },
            { key: "qosSync", name: "QoSSync" },
            { key: "qosAvailability", name: "QoSAvailability" },
            { key: "qosLatency", name: "QoSLatency" },
            { key: "qosSyncExc", name: "QoSSyncExc" },
            { key: "qosAvailabilityExc", name: "QoSAvailabilityExc" },
            { key: "qosLatencyExc", name: "QoSLatencyExc" },
            { key: "provider", name: "Provider" },
            { key: "moniker", name: "Moniker" },
            { key: "specId", name: "SpecId" },
            { key: "blockId", name: "BlockId" },
            { key: "consumer", name: "Consumer" },
            { key: "tx", name: "Tx" },
        ];
        let csv = columns.map(column => CSVEscape(column.name)).join(',') + '\n';

        data.forEach((item: any) => {
            csv += columns.map(column => {
                const keys = column.key.split('.');
                const value = keys.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : '', item);
                return CSVEscape(String(value));
            }).join(',') + '\n';
        });

        return csv;
    }
}

export async function EventsRewardsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function EventsRewardsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().getTotalItemCountPaginatedHandler(request, reply)
}

export async function EventsRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().CSVRequestHandler(request, reply)
}