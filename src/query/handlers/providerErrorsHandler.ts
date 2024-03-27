
// src/query/handlers/providerErrors.ts

import fs from 'fs';
import path from 'path';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetRelaysReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { eq, desc } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest } from '../queryPagination';
import { CompareValues } from '../queryUtils';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS } from '../queryConsts';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

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

export const ProviderErrorsHandlerOpts: RouteShorthandOptions = {
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

const parseError = (error: string): string => {
    if (error.includes("Code(3369)")) {
        return "provider does not handle requested api interface and spec";
    } else if (error.includes("502 (Bad Gateway); transport: received unexpected content-type")) {
        return 'transport: received unexpected content-type "text/html"';
    } else if (error.includes("Consistency Error code 3368")) {
        return "Requested a block that is too new and does not meet consistency requirements";
    } else if (error.includes("malformed header: missing HTTP content-type")) {
        return "malformed header: missing HTTP content-type";
    }

    let errMsgIndex = error.indexOf("ErrMsg:");
    let descIndex = error.indexOf("desc =");
    if (errMsgIndex !== -1) {
        let end = error.slice(errMsgIndex).search(/[(,.:;)]/);
        return error.slice(errMsgIndex, errMsgIndex + end).trim();
    } else if (descIndex !== -1) {
        let end = error.slice(descIndex).search(/[(,.:;)]/);
        return error.slice(descIndex, descIndex + end).trim();
    } else {
        return error.slice(0, 200).trim();
    }
}

class ProviderErrorsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS;

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderErrorsHandlerData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<ErrorsReportReponse[]> {
        const result = await QueryGetRelaysReadDbInstance().select().from(schema.lavaReportError)
            .where(eq(schema.lavaReportError.provider, this.addr))
            .orderBy(desc(schema.lavaReportError.created_at)).offset(0).limit(5000)

        return result.map((row: ErrorsReport) => ({
            id: row.id,
            date: row.created_at?.toISOString() || '',
            spec: row.spec_id || '',
            error: parseError(row.errors || ''),
        })).filter((report: ErrorsReportReponse) => report.date && report.error);
    }

    private async fetchDataFromCache(): Promise<ErrorsReportReponse[]> {
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

    public async getTotalItemCount(): Promise<number> {
        const data = await this.fetchDataFromCache();
        return data.length;
    }

    public async getPaginatedItems(pagination: Pagination | null): Promise<ErrorsReportReponse[]> {
        let data = await this.fetchDataFromCache();

        if (pagination == null) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        data = this.sortData(data, pagination.sortKey || "", pagination.direction);

        const start = (pagination.page - 1) * pagination.count;
        const end = start + pagination.count;

        // If slice would fail, return a [0,20] slice
        if (start < 0 || end < 0 || start > data.length || end > data.length) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        return data.slice(start, end);
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

    public async getCSV(): Promise<string> {
        const data = await this.fetchDataFromCache();
        let csv = 'date,spec,error\n';
        data.forEach((item: ErrorsReportReponse) => {
            csv += `${item.date},${this.escape(item.spec)},${this.escape(item.error)}\n`;
        });
        return csv;
    }

    private escape(str: string): string {
        return `"${str.replace(/"/g, '""')}"`;
    }
}

export async function ProviderErrorsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerErrorsData = new ProviderErrorsData(addr);
    const count = await providerErrorsData.getTotalItemCount();

    return { itemCount: count };
}

export async function ProviderErrorsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    let pagination: Pagination | null = ParsePaginationFromRequest(request)
    const providerErrorsData = new ProviderErrorsData(addr);
    const res: ErrorsReportReponse[] = await providerErrorsData.getPaginatedItems(pagination);

    if (!res || res.length === 0 || Object.keys(res).length === 0) {
        console.log(`ProviderErrorsHandler:: No health info for provider ${addr} in database.`);
    }

    return { data: res };
}

export async function ProviderErrorsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerErrorsData = new ProviderErrorsData(addr);
    const csv = await providerErrorsData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderErrors_${addr}.csv`);
    reply.send(csv);
}