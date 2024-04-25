
// src/query/handlers/providerEventsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';

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
                                        eventType: { type: 'number' },
                                        t1: { type: ['string', 'null'] },
                                        t2: { type: ['string', 'null'] },
                                        t3: { type: ['string', 'null'] },
                                        b1: { type: 'number' },
                                        b2: { type: 'number' },
                                        b3: { type: ['number', 'null'] },
                                        i1: { type: ['number', 'null'] },
                                        i2: { type: ['number', 'null'] },
                                        i3: { type: ['number', 'null'] },
                                        r1: { type: ['number', 'null'] },
                                        r2: { type: ['number', 'null'] },
                                        r3: { type: ['number', 'null'] },
                                        provider: { type: 'string' },
                                        consumer: { type: ['string', 'null'] },
                                        blockId: { type: 'number' },
                                        tx: { type: ['string', 'null'] },
                                    },
                                    required: ['id', 'eventType', 'b1', 'b2', 'provider', 'blockId']
                                },
                                blocks: {
                                    type: 'object',
                                    properties: {
                                        height: { type: 'number' },
                                        datetime: { type: 'string' },
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


class ProviderEventsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderEventsData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<any[]> {
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

    private async fetchDataFromCache(): Promise<any[]> {
        const cacheFilePath = this.getCacheFilePath();
        if (JSINFO_QUERY_CACHE_ENABLED && fs.existsSync(cacheFilePath)) {
            const stats = fs.statSync(cacheFilePath);
            const ageInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;
            if (ageInSeconds <= this.cacheAgeLimit) {
                return JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
            }
        }

        const data = await this.fetchDataFromDb();
        fs.writeFileSync(cacheFilePath, JSON.stringify(data));
        return data;
    }

    public async getPaginatedItems(request: FastifyRequest): Promise<{ data: any[] }> {
        let data = await this.fetchDataFromCache();

        let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("blocks.datetime,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "blocks.datetime";

        // Validate sortKey
        const validKeys = ["events.eventType", "blocks.height", "blocks.datetime", "events.b1", "events.b2", "events.b3", "events.i1", "events.i2", "events.i3", "events.t1", "events.t2", "events.t3"];
        if (!validKeys.includes(pagination.sortKey)) {
            throw new Error('Invalid sort key');
        }

        // Apply sorting
        const sortKeyParts = pagination.sortKey.split('.');
        data.sort((a, b) => {
            const aValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, a);
            const bValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, b);
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return { data: data };
    }

    public async getTotalItemCount(): Promise<number> {
        const data = await this.fetchDataFromCache();
        return data.length;
    }

    public async getCSV(): Promise<string> {
        const data = await this.fetchDataFromCache();
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
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
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
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const providerEventsData = new ProviderEventsData(addr);
    const itemCount = await providerEventsData.getTotalItemCount();
    return { itemCount: itemCount }
}

export async function ProviderEventsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderEventsData(addr);
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderEvents_${addr}.csv`);
    reply.send(csv);
}