// src/query/handlers/eventsReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { asc, desc, eq, gte, gt } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetDataLength, SafeSlice } from '../utils/queryUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

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

export const EventsReportsCachedHandlerOpts: RouteShorthandOptions = {
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


class EventsReportsData extends RequestHandlerBase<EventsReportsResponse> {

    constructor() {
        super("EventsReportsData");
    }

    public GetInstance(): EventsReportsData {
        return EventsReportsData.GetInstance();
    }

    protected getCSVFileNameImpl(): string {
        return `EventsReports.csv`;
    }

    protected async fetchAllDataFromDb(): Promise<EventsReportsResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const blockHeightQuery = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.blocks)
            .where(gte(JsinfoSchema.blocks.datetime, thirtyDaysAgo))
            .orderBy(asc(JsinfoSchema.blocks.datetime))
            .limit(1);

        const minBlockHeight = blockHeightQuery[0].height || 0;

        const reportsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerReported.provider, JsinfoSchema.providers.address))
            .where(gte(JsinfoSchema.providerReported.blockId, minBlockHeight))
            .orderBy(desc(JsinfoSchema.providerReported.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const flattenedEvents = reportsRes.map(data => ({
            ...data.provider_reported,
            moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
        }));

        return flattenedEvents;
    }
    public async fetchDataWithPaginationFromDb(pagination: Pagination): Promise<EventsReportsResponse[] | null> {
        const defaultSortKey = "datetime";

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

        // Validate sortKey
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
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            if (finalPagination.sortKey !== null) {
                const aValue = a[finalPagination.sortKey];
                const bValue = b[finalPagination.sortKey];
                return CompareValues(aValue, bValue, finalPagination.direction);
            }
            return 0;
        });

        // Apply pagination
        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
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

export async function EventsReportsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function EventsReportsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function EventsReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().getCSVRawHandler(request, reply)
}