
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { eq, desc, asc, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { ParseDateToUtc } from '@jsinfo/utils/date';
import { logger } from '@jsinfo/utils/logger';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface HealthReportEntry {
    message: string | null;
    block: number | null;
    latency: number | null;
    status: string;
    blocksaway: number | null;
    timestamp: Date;
    id: number;
    provider: string | null;
    spec: string;
    interface: string | null;
    region?: string;
}

export const ProviderHealthPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                id: { type: 'string' },
                                provider: { type: 'string' },
                                timestamp: { type: 'string' },
                                spec: { type: 'string' },
                                interface: { type: 'string' },
                                status: { type: 'string' },
                                message: { type: 'string' },
                                region: { type: 'string' },
                            },
                            required: ['id', 'timestamp', 'spec', 'interface', 'status', 'message']
                        }
                    }
                }
            }
        }
    }
}

class ProviderHealthData extends RequestHandlerBase<HealthReportEntry> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderHealthData");

        if (typeof addr !== 'string') {
            throw new Error(`Invalid type for addr. Expected string but received ${typeof addr}. addr: ${addr}`);
        }

        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderHealthData {
        return ProviderHealthData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderHealth_${this.addr}.csv`;
    }

    protected getTTL(key: string): number {
        return 120;
    }

    protected async fetchAllRecords(): Promise<HealthReportEntry[]> {
        const data = await queryJsinfo(db => db.select()
            .from(JsinfoSchema.providerHealth)
            .where(eq(JsinfoSchema.providerHealth.provider, this.addr))
            .orderBy(desc(JsinfoSchema.providerHealth.id))
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            'ProviderHealthData::fetchAllRecords'
        );

        const healthReportEntries: HealthReportEntry[] = data.map(item => ({
            id: item.id,
            provider: item.provider,
            timestamp: item.timestamp,
            spec: item.spec,
            interface: item.interface,
            status: item.status,
            region: item.geolocation || "",
            message: ParseMessageFromHealthV2(item.data),
            block: null,
            latency: null,
            blocksaway: null,
        }));

        return healthReportEntries;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        ;

        const countResult = await queryJsinfo(db => db.select({
            count: sql<number>`COUNT(*)`
        })
            .from(JsinfoSchema.providerHealth),
            'ProviderHealthData::fetchRecordCountFromDb'
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<HealthReportEntry[]> {
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
            id: JsinfoSchema.providerHealth.id,
            timestamp: JsinfoSchema.providerHealth.timestamp,
            spec: JsinfoSchema.providerHealth.spec,
            interface: JsinfoSchema.providerHealth.interface,
            status: JsinfoSchema.providerHealth.status,
            region: JsinfoSchema.providerHealth.geolocation,
            message: JsinfoSchema.providerHealth.data
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        ;

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const offset = (finalPagination.page - 1) * finalPagination.count;

        const additionalData = await queryJsinfo(db => db
            .select()
            .from(JsinfoSchema.providerHealth)
            .where(eq(JsinfoSchema.providerHealth.provider, this.addr))
            .orderBy(orderFunction(sortColumn))
            .offset(offset)
            .limit(finalPagination.count),
            'ProviderHealthData::fetchPaginatedRecords'
        );

        const healthReportEntries: HealthReportEntry[] = additionalData.map(item => ({
            id: item.id,
            provider: item.provider,
            timestamp: item.timestamp,
            spec: item.spec,
            interface: item.interface,
            status: item.status,
            region: item.geolocation || "",
            message: ParseMessageFromHealthV2(item.data),
            block: null,
            latency: null,
            blocksaway: null,
        }));

        return healthReportEntries;
    }

    protected async convertRecordsToCsv(data: HealthReportEntry[]): Promise<string> {
        let csv = 'time,chain,interface,status,region,message\n';
        data.forEach((item: HealthReportEntry) => {
            csv += `${item.timestamp},${CSVEscape(item.spec)},${CSVEscape(item.interface || "")},${CSVEscape(item.status)},${CSVEscape(item.message || "")}\n`;
        });
        return csv;
    }
}


const ParseMessageFromHealthV2 = (data: string | null): string => {
    if (!data) return "";
    try {
        const parsedData = JSON.parse(data);

        if (parsedData.message) {
            return parsedData.message;
        }

        if (parsedData.jail_end_time && parsedData.jails) {
            const date = ParseDateToUtc(parsedData.jail_end_time);
            // bad db data
            const is1970Included = `${parsedData.jail_end_time}${parsedData.jails}${date}`.includes("1970-01-01");
            if (is1970Included) return "";
            let formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            return `Jail end time: ${formattedDate}, Jails: ${parsedData.jails}`;
        }

        if (parsedData.block && parsedData.others) {
            const blockMessage = `Block: 0x${(parsedData.block).toString(16)}`;
            const latestBlock = parsedData.others;
            let finalMessage = `${blockMessage}, Others: 0x${(latestBlock).toString(16)}`;

            if (parsedData.latency) {
                const latencyInMs = parsedData.latency / 1000000;
                finalMessage += `. Latency: ${latencyInMs.toFixed(0)}ms`;
            }

            return finalMessage;
        }

        return "";
    } catch (e) {
        logger.error('ParseMessageFromHealthV2 - failed parsing data:', e);
        return "";
    }
}

export async function ProviderHealthPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerHealth", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderHealthData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply);
}

export async function ProviderHealthItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerHealth", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderHealthCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerHealth", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).CSVRequestHandler(request, reply);
}