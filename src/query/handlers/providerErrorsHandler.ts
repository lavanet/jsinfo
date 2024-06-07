
// src/query/handlers/providerErrors.ts

import path from 'path';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckRelaysReadDbInstance, QueryGetRelaysReadDbInstance } from '../queryDb';
import { eq, desc, and, gt } from "drizzle-orm";
import { Pagination } from '../utils/queryPagination';
import { CSVEscape, CompareValues, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { ParseLavapProviderError } from '../utils/lavapProvidersErrorParser';
import * as RelaysSchema from '../../schemas/relaysSchema';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';
export interface ErrorsReport {
    id: number;
    created_at: Date | null;
    provider: string | null;
    spec_id: string | null;
    errors: string | null;
}

export interface ErrorsReportReponse {
    id: number;
    date: string;
    spec: string;
    error: string;
}

export const ProviderErrorsCachedHandlerOpts: RouteShorthandOptions = {
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

class ProviderErrorsData extends CachedDiskDbDataFetcher<ErrorsReportReponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderErrorsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderErrorsData {
        return ProviderErrorsData.GetInstanceBase(addr);
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderErrorsHandlerData_${this.addr}`);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderErrors_${this.addr}.csv`;
    }

    protected isSinceDBFetchEnabled(): boolean {
        return true;
    }

    protected sinceUniqueField(): string {
        return "id";
    }

    protected async fetchDataFromDb(): Promise<ErrorsReportReponse[]> {
        await QueryCheckRelaysReadDbInstance();

        const result = await QueryGetRelaysReadDbInstance().select().from(RelaysSchema.lavaReportError)
            .where(eq(RelaysSchema.lavaReportError.provider, this.addr))
            .orderBy(desc(RelaysSchema.lavaReportError.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return result.map((row: ErrorsReport) => ({
            id: row.id,
            date: row.created_at?.toISOString() || '',
            spec: row.spec_id || '',
            error: ParseLavapProviderError(row.errors || ''),
        })).filter((report: ErrorsReportReponse) => report.date && report.error);
    }

    protected async fetchDataFromDbSinceFlow(since: number | string): Promise<ErrorsReportReponse[]> {
        await QueryCheckRelaysReadDbInstance()

        const result = await QueryGetRelaysReadDbInstance().select().from(RelaysSchema.lavaReportError)
            .where(and(
                eq(RelaysSchema.lavaReportError.provider, this.addr),
                gt(RelaysSchema.lavaReportError.id, Number(since))
            ))
            .orderBy(desc(RelaysSchema.lavaReportError.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return result.map((row: ErrorsReport) => ({
            id: row.id,
            date: row.created_at?.toISOString() || '',
            spec: row.spec_id || '',
            error: ParseLavapProviderError(row.errors || ''),
        })).filter((report: ErrorsReportReponse) => report.date && report.error);
    }

    public async getPaginatedItemsImpl(data: ErrorsReportReponse[], pagination: Pagination | null): Promise<ErrorsReportReponse[] | null> {
        if (pagination == null) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        data = this.sortData(data, pagination.sortKey || "", pagination.direction);

        const start = (pagination.page - 1) * pagination.count;
        const end = start + pagination.count;

        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
    }

    private sortData(data: ErrorsReportReponse[], sortKey: string, direction: 'ascending' | 'descending'): ErrorsReportReponse[] {
        if (sortKey === "-" || sortKey === "") sortKey = "date";

        if (sortKey && ["date", "spec", "error"].includes(sortKey)) {
            if (sortKey !== "date" || direction !== "descending") {
                // default
            }
        } else {
            console.log(`Invalid sortKey: ${sortKey}`);
        }

        return data.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, direction);
        });
    }

    public async getCSVImpl(data: ErrorsReportReponse[]): Promise<string> {
        let csv = 'date,spec,error\n';
        data.forEach((item: ErrorsReportReponse) => {
            csv += `${item.date},${CSVEscape(item.spec)},${CSVEscape(item.error)}\n`;
        });
        return csv;
    }
}

export async function ProviderErrorsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderErrorsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderErrorsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderErrorsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderErrorsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderErrorsData.GetInstance(addr).getCSVRawHandler(request, reply)
}