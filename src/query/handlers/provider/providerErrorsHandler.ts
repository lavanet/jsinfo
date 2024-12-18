
// src/query/handlers/providerErrors.ts

import * as RelaysSchema from '@jsinfo/schemas/relaysSchema';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { eq, desc, sql, asc } from "drizzle-orm";
import { Pagination } from '@jsinfo/query/utils/queryPagination';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { ParseLavapProviderError } from '@jsinfo/query/utils/lavapProvidersErrorParser';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { queryRelays } from '@jsinfo/utils/db';
export interface ErrorsReport {
    id: number;
    created_at: Date | null;
    provider: string | null;
    spec_id: string | null;
    errors: string | null;
}

export interface ErrorsReportResponse {
    id: number;
    date: string;
    spec: string;
    error: string;
}

export const ProviderErrorsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                id: { type: ['string', 'number'] },
                                date: { type: 'string' },
                                spec: { type: 'string' },
                                error: { type: 'string' },
                            }
                        }
                    }
                }
            }
        }
    }
}

class ProviderErrorsData extends RequestHandlerBase<ErrorsReportResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderErrorsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderErrorsData {
        return ProviderErrorsData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderErrors_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ErrorsReportResponse[]> {


        const result = await queryRelays(
            async (db) => await db.select().from(RelaysSchema.lavaReportError)
                .where(eq(RelaysSchema.lavaReportError.provider, this.addr))
                .orderBy(desc(RelaysSchema.lavaReportError.id))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            "ProviderErrorsData"
        );

        return result.map((row: ErrorsReport) => ({
            id: row.id,
            date: row.created_at?.toISOString() || '',
            spec: row.spec_id || '',
            error: ParseLavapProviderError(row.errors || ''),
        }));
    }

    protected async fetchRecordCountFromDb(): Promise<number> {


        const countResult = await queryRelays(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)`
            })
                .from(RelaysSchema.lavaReportError)
                .where(eq(RelaysSchema.lavaReportError.provider, this.addr)),
            "ProviderErrorsData"
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ErrorsReportResponse[]> {


        const defaultSortKey = "id";

        if (!pagination) {
            pagination = {
                sortKey: defaultSortKey,
                direction: "descending",
                page: 1,
                count: JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE
            };
        }

        const keyToColumnMap = {
            id: RelaysSchema.lavaReportError.id,
            date: RelaysSchema.lavaReportError.created_at,
            spec: RelaysSchema.lavaReportError.spec_id,
            error: RelaysSchema.lavaReportError.errors
        };

        const sortColumn = keyToColumnMap[pagination.sortKey || defaultSortKey] || keyToColumnMap[defaultSortKey];
        const orderFunction = pagination.direction === 'ascending' ? asc : desc;

        const result = await queryRelays(
            async (db) => await db.select({
                id: RelaysSchema.lavaReportError.id,
                created_at: RelaysSchema.lavaReportError.created_at,
                spec_id: RelaysSchema.lavaReportError.spec_id,
                errors: RelaysSchema.lavaReportError.errors
            })
                .from(RelaysSchema.lavaReportError)
                .where(eq(RelaysSchema.lavaReportError.provider, this.addr))
                .orderBy(orderFunction(sortColumn))
                .offset((pagination.page - 1) * pagination.count)
                .limit(pagination.count),
            "ProviderErrorsData"
        );

        return result.map(row => ({
            id: row.id,
            date: row.created_at ? row.created_at.toISOString() : '',
            spec: row.spec_id || '',
            error: ParseLavapProviderError(row.errors || '')
        }));
    }


    public async ConvertRecordsToCsv(data: ErrorsReportResponse[]): Promise<string> {
        let csv = 'date,chain,error\n';
        data.forEach((item: ErrorsReportResponse) => {
            csv += `${item.date},${CSVEscape(item.spec)},${CSVEscape(item.error)}\n`;
        });
        return csv;
    }
}

export async function ProviderErrorsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerErrors", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderErrorsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderErrorsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerErrors", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderErrorsData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderErrorsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerErrors", request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderErrorsData.GetInstance(addr).CSVRequestHandler(request, reply)
}