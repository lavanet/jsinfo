// src/query/handlers/eventsReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { asc, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';
import { CachedDiskPsqlQuery } from '../classes/CachedDiskPsqlQuery';

export interface EventsReportsResponse {
    provider: string | null;
    moniker: string | null;
    blockId: number | null;
    cu: number | null;
    disconnections: number | null;
    epoch: number | null;
    errors: number | null;
    project: string | null;
    datetime: Date | null;
    totalComplaintEpoch: number | null;
    tx: string | null;
}

export const EventsReportsHandlerOpts: RouteShorthandOptions = {
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
                                provider: { type: ['string', 'null'] },
                                moniker: { type: ['string', 'null'] },
                                blockId: { type: ['number', 'null'] },
                                cu: { type: ['number', 'null'] },
                                disconnections: { type: ['number', 'null'] },
                                epoch: { type: ['number', 'null'] },
                                errors: { type: ['number', 'null'] },
                                project: { type: ['string', 'null'] },
                                datetime: { type: ['string', 'null'] },
                                totalComplaintEpoch: { type: ['number', 'null'] },
                                tx: { type: ['string', 'null'] },
                            }
                        }
                    }
                }
            }
        }
    }
};


class EventsReportsData extends CachedDiskPsqlQuery<EventsReportsResponse> {

    constructor() {
        super();
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, 'EventsReportsHandlerData');
    }

    protected async fetchDataFromDb(): Promise<EventsReportsResponse[]> {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const blockHeightQuery = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.blocks)
            .where(gte(JsinfoSchema.blocks.datetime, thirtyDaysAgo))
            .orderBy(asc(JsinfoSchema.blocks.datetime))
            .limit(1);

        const minBlockHeight = blockHeightQuery[0].height || 0;

        const query = QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerReported.provider, JsinfoSchema.providers.address))
            .where(gte(JsinfoSchema.providerReported.blockId, minBlockHeight))
            .orderBy(desc(JsinfoSchema.providerReported.blockId))
            .limit(100);

        const reportsRes = await query;

        const flattenedEvents = reportsRes.map(data => ({
            ...data.provider_reported,
            moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
        }));

        return flattenedEvents;
    }

    public async getPaginatedItemsImpl(data: EventsReportsResponse[], pagination: Pagination | null): Promise<EventsReportsResponse[] | null> {
        const defaultSortKey = "datetime"
        pagination = pagination || ParsePaginationFromString(defaultSortKey + ",descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = defaultSortKey;

        const validKeys = [
            "provider",
            "moniker",
            "blockId",
            "cu",
            "disconnections",
            "epoch",
            "errors",
            "project",
            "datetime",
            "totalComplaintEpoch",
            "tx"
        ];

        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = a[pagination.sortKey || defaultSortKey];
            const bValue = b[pagination.sortKey || defaultSortKey];
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
    }

    public async getCSVImpl(data: EventsReportsResponse[]): Promise<string> {
        const columns = [
            { key: "provider", name: "Provider" },
            { key: "moniker", name: "Moniker" },
            { key: "blockId", name: "BlockId" },
            { key: "cu", name: "CU" },
            { key: "disconnections", name: "Disconnections" },
            { key: "epoch", name: "Epoch" },
            { key: "errors", name: "Errors" },
            { key: "project", name: "Project" },
            { key: "datetime", name: "Datetime" },
            { key: "totalComplaintEpoch", name: "Total Complaint Epoch" },
            { key: "tx", name: "Tx" }
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

export async function EventsReportsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providerRewardsData = new EventsReportsData();
    try {
        const data = await providerRewardsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function EventsReportsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const eventsEventsData = new EventsReportsData();
    return eventsEventsData.getTotalItemCount();
}

export async function EventsReportsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const eventsEventsData = new EventsReportsData();
    const csv = await eventsEventsData.getCSV();

    if (csv === null) {
        return;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=EventsReports.csv`);
    reply.send(csv);

    return reply;
}
