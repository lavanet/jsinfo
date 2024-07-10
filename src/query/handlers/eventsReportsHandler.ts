// src/query/handlers/eventsReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CSVEscape } from '../utils/queryUtils';
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
    datetime: string | null;
    totalComplaintEpoch: number | null;
    tx: string | null;
}

export const EventsReportsPaginatedHandlerOpts: RouteShorthandOptions = {
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

    public static GetInstance(): EventsReportsData {
        return EventsReportsData.GetInstanceBase();
    }

    protected getCSVFileNameImpl(): string {
        return `EventsReports.csv`;
    }

    protected async fetchAllRecords(): Promise<EventsReportsResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        const reportsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerReported.provider, JsinfoSchema.providers.address))
            .orderBy(desc(JsinfoSchema.providerReported.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const flattenedEvents = reportsRes.map(data => ({
            ...data.provider_reported,
            moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
            datetime: data.provider_reported.datetime?.toISOString() ?? null
        }));

        return flattenedEvents;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(*)`
            })
            .from(JsinfoSchema.providerReported)

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<EventsReportsResponse[]> {
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
            id: JsinfoSchema.providerReported.id,
            provider: JsinfoSchema.providerReported.provider,
            moniker: JsinfoSchema.providers.moniker,
            blockId: JsinfoSchema.providerReported.blockId,
            cu: JsinfoSchema.providerReported.cu,
            disconnections: JsinfoSchema.providerReported.disconnections,
            epoch: JsinfoSchema.providerReported.epoch,
            errors: JsinfoSchema.providerReported.errors,
            project: JsinfoSchema.providerReported.project,
            datetime: JsinfoSchema.providerReported.datetime,
            totalComplaintEpoch: JsinfoSchema.providerReported.totalComplaintEpoch,
            tx: JsinfoSchema.providerReported.tx
        };

        const validKeys = Object.keys(keyToColumnMap);

        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance()

        const sortColumn = keyToColumnMap[finalPagination.sortKey]; // Use mapped column name for sorting
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const offset = (finalPagination.page - 1) * finalPagination.count;

        const reportsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerReported.provider, JsinfoSchema.providers.address))
            .orderBy(orderFunction(sortColumn))
            .offset(offset)
            .limit(finalPagination.count);

        const flattenedReports = reportsRes.map(data => ({
            ...data.provider_reported,
            moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
            datetime: data.provider_reported.datetime?.toISOString() ?? null
        }));

        return flattenedReports;
    }

    protected async convertRecordsToCsv(data: EventsReportsResponse[]): Promise<string> {
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

export async function EventsReportsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function EventsReportsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().getTotalItemCountPaginatiedHandler(request, reply)
}

export async function EventsReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsReportsData.GetInstance().CSVRequestHandler(request, reply)
}