// src/query/handlers/events/eventsEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { queryJsinfo } from '@jsinfo/utils/db';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';

export interface EventsEventsResponse {
    id: number | null;
    eventType: number | null;
    t1: string | null;
    t2: string | null;
    t3: string | null;
    b1: string | bigint | null;
    b2: string | bigint | null;
    b3: string | bigint | null;
    i1: number | null;
    i2: number | null;
    i3: number | null;
    r1: number | null;
    r2: number | null;
    r3: number | null;
    provider: string | null;
    moniker: string | null;
    monikerfull: string | null;
    consumer: string | null;
    blockId: number | null;
    datetime: string | null;
    tx: string | null;
    fulltext: string | null;
}

export const EventsEventsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                eventType: { type: ['number', 'null'] },
                                t1: { type: ['string', 'null'] },
                                t2: { type: ['string', 'null'] },
                                t3: { type: ['string', 'null'] },
                                b1: { type: ['string', 'null'] },
                                b2: { type: ['string', 'null'] },
                                b3: { type: ['string', 'null'] },
                                i1: { type: ['number', 'null'] },
                                i2: { type: ['number', 'null'] },
                                i3: { type: ['number', 'null'] },
                                r1: { type: ['number', 'null'] },
                                r2: { type: ['number', 'null'] },
                                r3: { type: ['number', 'null'] },
                                provider: { type: ['string', 'null'] },
                                moniker: { type: ['string', 'null'] },
                                monikerfull: { type: ['string', 'null'] },
                                consumer: { type: ['string', 'null'] },
                                blockId: { type: ['number', 'null'] },
                                datetime: { type: ['string', 'null'] },
                                tx: { type: ['string', 'null'] },
                                fulltext: { type: ['string', 'null'] }
                            }
                        }
                    }
                }
            }
        }
    }
};
class EventsEventsData extends RequestHandlerBase<EventsEventsResponse> {

    constructor() {
        super("EventsEventsData");
    }

    public static GetInstance(): EventsEventsData {
        return EventsEventsData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `EventsData.csv`;
    }

    protected async fetchAllRecords(): Promise<EventsEventsResponse[]> {
        const eventsRes = await queryJsinfo(
            async (db) => await db.select()
                .from(JsinfoSchema.events)
                .where(sql`timestamp >= NOW() - INTERVAL '30 days'`)
                .orderBy(desc(JsinfoSchema.events.id))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            'EventsEventsData_fetchAllRecords'
        );

        const flattenedEvents = await Promise.all(eventsRes.map(async event => ({
            ...event,
            b1: event.b1?.toString() ?? null,
            b2: event.b2?.toString() ?? null,
            b3: event.b3?.toString() ?? null,
            moniker: event.provider ? await ProviderMonikerService.GetMonikerForProvider(event.provider) : null,
            monikerfull: event.provider ? await ProviderMonikerService.GetMonikerFullDescription(event.provider) : null,
            datetime: event.timestamp?.toISOString() ?? null,
            fulltext: event.fulltext ?? null
        })));

        return flattenedEvents;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        const countResult = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)::int`
            })
                .from(JsinfoSchema.events),
            'EventsEventsData_fetchRecordCountFromDb'
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<EventsEventsResponse[]> {
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
            id: JsinfoSchema.events.id,
            eventType: JsinfoSchema.events.eventType,
            t1: JsinfoSchema.events.t1,
            t2: JsinfoSchema.events.t2,
            t3: JsinfoSchema.events.t3,
            b1: JsinfoSchema.events.b1,
            b2: JsinfoSchema.events.b2,
            b3: JsinfoSchema.events.b3,
            i1: JsinfoSchema.events.i1,
            i2: JsinfoSchema.events.i2,
            i3: JsinfoSchema.events.i3,
            r1: JsinfoSchema.events.r1,
            r2: JsinfoSchema.events.r2,
            r3: JsinfoSchema.events.r3,
            provider: JsinfoSchema.events.provider,
            moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker})`,
            consumer: JsinfoSchema.events.consumer,
            blockId: JsinfoSchema.events.blockId,
            datetime: JsinfoSchema.events.timestamp, // Use timestamp from events table
            tx: JsinfoSchema.events.tx,
            fulltext: JsinfoSchema.events.fulltext
        };

        const validKeys = Object.keys(keyToColumnMap);

        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        const sortColumn = keyToColumnMap[finalPagination.sortKey] || JsinfoSchema.events.id; // Default to id if not found

        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const offset = (finalPagination.page - 1) * finalPagination.count;

        let eventsRes: any | null = null;
        if (sortColumn === keyToColumnMap["moniker"]) {
            eventsRes = await queryJsinfo(
                async (db) => await db.select()
                    .from(JsinfoSchema.events)
                    .leftJoin(JsinfoSchema.providerSpecMoniker, eq(JsinfoSchema.events.provider, JsinfoSchema.providerSpecMoniker.provider))
                    .where(sql`timestamp >= NOW() - INTERVAL '30 days'`)
                    .orderBy(orderFunction(sortColumn))
                    .offset(offset)
                    .limit(finalPagination.count),
                `EventsEventsData_fetchPaginatedRecords_withMoniker_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
            );
        } else {
            eventsRes = await queryJsinfo(
                async (db) => await db.select()
                    .from(JsinfoSchema.events)
                    .where(sql`timestamp >= NOW() - INTERVAL '30 days'`)
                    .orderBy(orderFunction(sortColumn))
                    .offset(offset)
                    .limit(finalPagination.count),
                `EventsEventsData_fetchPaginatedRecords_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
            );
        }

        const flattenedEvents = await Promise.all(eventsRes.map(async event => ({
            ...event,
            b1: event.b1?.toString() ?? null,
            b2: event.b2?.toString() ?? null,
            b3: event.b3?.toString() ?? null,
            moniker: event.provider ? await ProviderMonikerService.GetMonikerForProvider(event.provider) : null,
            monikerfull: event.provider ? await ProviderMonikerService.GetMonikerFullDescription(event.provider) : null,
            datetime: event.timestamp?.toISOString() ?? null,
            fulltext: event.fulltext ?? null
        })));

        return flattenedEvents;
    }

    public async ConvertRecordsToCsv(data: EventsEventsResponse[]): Promise<string> {
        const columns = [
            { key: "provider", name: "Provider" },
            { key: "moniker", name: "Moniker" },
            { key: "consumer", name: "Consumer" },
            { key: "blockId", name: "BlockId" },
            { key: "datetime", name: "Time" },
            { key: "eventType", name: "EventType" },
            { key: "fulltext", name: "Fulltext" },
            { key: "tx", name: "Tx" },
            { key: "t1", name: "Text1" },
            { key: "t2", name: "Text2" },
            { key: "t3", name: "Text3" },
            { key: "b1", name: "BigInt1" },
            { key: "b2", name: "BigInt2" },
            { key: "b3", name: "BigInt3" },
            { key: "i1", name: "Int1" },
            { key: "i2", name: "Int2" },
            { key: "i3", name: "Int3" },
            { key: "r1", name: "Float1" },
            { key: "r2", name: "Float2" },
            { key: "r3", name: "Float3" },
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

export async function EventsEventsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsEventsData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function EventsEventsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsEventsData.GetInstance().getTotalItemCountPaginatedHandler(request, reply)
}

export async function EventsEventsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsEventsData.GetInstance().CSVRequestHandler(request, reply)
}