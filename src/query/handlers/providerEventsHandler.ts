
// src/query/handlers/providerEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CSVEscape, CompareValues, GetAndValidateProviderAddressFromRequest, GetNestedValue } from '../utils/queryUtils';
import { CachedDiskPsqlQuery } from '../classes/CachedDiskPsqlQuery';

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

export const ProviderEventsHandlerOpts: RouteShorthandOptions = {
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
                                        eventType: { type: ['string', 'null'] },
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


class ProviderEventsData extends CachedDiskPsqlQuery<ProviderEventsResponse> {
    private addr: string;

    constructor(addr: string) {
        super();
        this.addr = addr;
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderEventsData_${this.addr}`);
    }

    protected async fetchDataFromDb(): Promise<ProviderEventsResponse[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const eventsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.events).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.events.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.events.provider, this.addr),
                    gte(JsinfoSchema.blocks.datetime, thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.events.id)).offset(0).limit(5000)

        return eventsRes;
    }

    public async getPaginatedItemsImpl(data: ProviderEventsResponse[], pagination: Pagination | null): Promise<ProviderEventsResponse[] | null> {
        pagination = pagination || ParsePaginationFromString("blocks.datetime,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "blocks.datetime";

        // Validate sortKey
        const validKeys = ["events.eventType", "blocks.height", "blocks.datetime", "events.b1", "events.b2", "events.b3", "events.i1", "events.i2", "events.i3", "events.t1", "events.t2", "events.t3"];
        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = GetNestedValue(a, pagination.sortKey || "blocks.datetime");
            const bValue = GetNestedValue(b, pagination.sortKey || "blocks.datetime");

            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
    }


    public async getCSVImpl(data: ProviderEventsResponse[]): Promise<string> {
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

export async function ProviderEventsHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    const providerEventsData = new ProviderEventsData(addr);
    try {
        const data = await providerEventsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderEventsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    const providerEventsData = new ProviderEventsData(addr);
    return providerEventsData.getTotalItemCount();
}

export async function ProviderEventsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const providerHealthData = new ProviderEventsData(addr);
    const csv = await providerHealthData.getCSV();

    if (csv === null) {
        return;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderEvents_${addr}.csv`);
    reply.send(csv);
}