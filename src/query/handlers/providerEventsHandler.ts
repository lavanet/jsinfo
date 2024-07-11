
// src/query/handlers/providerEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CSVEscape, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

export type ProviderEventsResponse = {
    events: {
        id: number;
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
        consumer: string | null;
        blockId: number | null;
        tx: string | null;
    };
    blocks: { height: number | null; datetime: Date | null; } | null;
};

export const ProviderEventsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                events: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number' },
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
                                        consumer: { type: ['string', 'null'] },
                                        blockId: { type: ['number', 'null'] },
                                        tx: { type: ['string', 'null'] },
                                    },
                                    required: ['id', 'eventType', 'b1', 'b2', 'provider', 'blockId']
                                },
                                blocks: {
                                    type: 'object',
                                    properties: {
                                        height: { type: ['number', 'null'] },
                                        datetime: { type: ['string', 'null'] },
                                    },
                                    required: ['height', 'datetime']
                                }
                            },
                            required: ['events', 'blocks']
                        }
                    }
                }
            }
        }
    }
}


class ProviderEventsData extends RequestHandlerBase<ProviderEventsResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderEventsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderEventsData {
        return ProviderEventsData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderEvents_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ProviderEventsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const eventsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.events).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.events.blockId, JsinfoSchema.blocks.height)).
            where(eq(JsinfoSchema.events.provider, this.addr)).
            orderBy(desc(JsinfoSchema.events.id)).offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        return eventsRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(*)`
            })
            .from(JsinfoSchema.events)
            .where(eq(JsinfoSchema.events.provider, this.addr));

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ProviderEventsResponse[]> {
        const defaultSortKey = "events.id";
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
            "events.id": JsinfoSchema.events.id,
            "events.eventType": JsinfoSchema.events.eventType,
            "blocks.height": JsinfoSchema.blocks.height,
            "blocks.datetime": JsinfoSchema.events.id, // ugly hack
            "events.b1": JsinfoSchema.events.b1,
            "events.b2": JsinfoSchema.events.b2,
            "events.b3": JsinfoSchema.events.b3,
            "events.i1": JsinfoSchema.events.i1,
            "events.i2": JsinfoSchema.events.i2,
            "events.i3": JsinfoSchema.events.i3,
            "events.t1": JsinfoSchema.events.t1,
            "events.t2": JsinfoSchema.events.t2,
            "events.t3": JsinfoSchema.events.t3
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const eventsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.events)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.events.blockId, JsinfoSchema.blocks.height))
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        return eventsRes;
    }

    protected async convertRecordsToCsv(data: ProviderEventsResponse[]): Promise<string> {
        const columns = [
            { key: "events.eventType", name: "Event Type" },
            { key: "blocks.height", name: "Block Height" },
            { key: "blocks.datetime", name: "Time" },
            { key: "events.t1", name: "Text1" },
            { key: "events.t2", name: "Text2" },
            { key: "events.t3", name: "Text3" },
            { key: "events.b1", name: "BigInt1" },
            { key: "events.b2", name: "BigInt2" },
            { key: "events.b3", name: "BigInt2" },
            { key: "events.i1", name: "Int1" },
            { key: "events.i2", name: "Int2" },
            { key: "events.i3", name: "Int3" },
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

export async function ProviderEventsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderEventsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderEventsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderEventsData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderEventsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderEventsData.GetInstance(addr).CSVRequestHandler(request, reply)
}