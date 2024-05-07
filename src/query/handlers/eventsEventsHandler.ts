// src/query/handlers/eventsEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { asc, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export interface EventsEventsResponse {
    id: number | null;
    eventType: number | null;
    t1: string | null;
    t2: string | null;
    t3: string | null;
    b1: number | null;
    b2: number | null;
    b3: number | null;
    i1: number | null;
    i2: number | null;
    i3: number | null;
    r1: number | null;
    r2: number | null;
    r3: number | null;
    provider: string | null;
    moniker: string | null;
    consumer: string | null;
    blockId: number | null;
    datetime: string | null;
    tx: string | null;
    fulltext: string | null;
}
export const EventsEventsHandlerOpts: RouteShorthandOptions = {
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
                                b1: { type: ['number', 'null'] },
                                b2: { type: ['number', 'null'] },
                                b3: { type: ['number', 'null'] },
                                i1: { type: ['number', 'null'] },
                                i2: { type: ['number', 'null'] },
                                i3: { type: ['number', 'null'] },
                                r1: { type: ['number', 'null'] },
                                r2: { type: ['number', 'null'] },
                                r3: { type: ['number', 'null'] },
                                provider: { type: ['string', 'null'] },
                                moniker: { type: ['string', 'null'] },
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

class EventsEventsData extends CachedDiskDbDataFetcher<EventsEventsResponse> {

    constructor() {
        super("EventsEventsData");
    }

    public static GetInstance(): EventsEventsData {
        return EventsEventsData.GetInstanceBase();
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, 'EventsEventsHandlerData');
    }

    protected getCSVFileName(): string {
        return `EventsData.csv`;
    }

    protected async fetchDataFromDb(): Promise<EventsEventsResponse[]> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const blockHeightQuery = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.blocks)
            .where(gte(JsinfoSchema.blocks.datetime, thirtyDaysAgo))
            .orderBy(asc(JsinfoSchema.blocks.datetime))
            .limit(1);

        const minBlockHeight = blockHeightQuery[0].height || 0;

        const eventsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.events)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.events.blockId, JsinfoSchema.blocks.height))
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.events.provider, JsinfoSchema.providers.address))
            .where(gte(JsinfoSchema.events.blockId, minBlockHeight))
            .orderBy(desc(JsinfoSchema.events.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const flattenedEvents = eventsRes.map(event => ({
            ...event.events,
            moniker: event.providers?.moniker !== undefined ? event.providers?.moniker : null,
            datetime: event.blocks?.datetime?.toISOString() ?? null
        }));

        return flattenedEvents;
    }

    public async getPaginatedItemsImpl(
        data: EventsEventsResponse[],
        pagination: Pagination | null
    ): Promise<EventsEventsResponse[] | null> {
        const defaultSortKey = "datetime";
        const defaultPagination = ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        // Use the provided pagination or the default one
        const finalPagination: Pagination = pagination ?? defaultPagination;

        // If sortKey is null, set it to the defaultSortKey
        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        // Validate sortKey
        const validKeys = [
            "id",
            "eventType",
            "t1",
            "t2",
            "t3",
            "b1",
            "b2",
            "b3",
            "i1",
            "i2",
            "i3",
            "r1",
            "r2",
            "r3",
            "provider",
            "moniker",
            "consumer",
            "blockId",
            "datetime",
            "tx",
            "fulltext"
        ];
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const sortKey = finalPagination.sortKey as keyof EventsEventsResponse;
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, finalPagination.direction);
        });

        // Apply pagination
        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        const paginatedData = data.slice(start, end);

        return paginatedData;
    }

    public async getCSVImpl(data: EventsEventsResponse[]): Promise<string> {
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

export async function EventsEventsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsEventsData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function EventsEventsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsEventsData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function EventsEventsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsEventsData.GetInstance().getCSVRawHandler(request, reply)
}