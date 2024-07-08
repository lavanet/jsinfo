
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq, desc, asc } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { CSVEscape, GetAndValidateProviderAddressFromRequest, ParseDateToUtc } from '../utils/queryUtils';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';
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

    protected getCSVFileNameImpl(): string {
        return `ProviderHealth_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<HealthReportEntry[]> {
        await QueryCheckJsinfoReadDbInstance();

        const data = await QueryGetJsinfoReadDbInstance().select()
            .from(JsinfoSchema.providerHealth)
            .where(eq(JsinfoSchema.providerHealth.provider, this.addr))
            .orderBy(desc(JsinfoSchema.providerHealth.id))
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const healthReportEntries: HealthReportEntry[] = data.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            spec: item.spec,
            interface: item.interface,
            status: item.status,
            region: item.geolocation || "",
            message: ParseMessageFromHealthV2(item.data),
            block: null,
            latency: null,
            blocksaway: null,
            provider: null
        }));

        return healthReportEntries;
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

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        // Calculate offset for pagination
        const offset = (finalPagination.page - 1) * finalPagination.count;

        const additionalData = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerHealth)
            .where(eq(JsinfoSchema.providerHealth.provider, this.addr))
            .orderBy(orderFunction(sortColumn))
            .offset(offset)
            .limit(finalPagination.count);

        const healthReportEntries: HealthReportEntry[] = additionalData.map(item => ({
            id: item.id,
            timestamp: item.timestamp,
            spec: item.spec,
            interface: item.interface,
            status: item.status,
            region: item.geolocation || "",
            message: ParseMessageFromHealthV2(item.data),
            block: null,
            latency: null,
            blocksaway: null,
            provider: null
        }));

        return healthReportEntries;
    }

    protected async convertRecordsToCsv(data: HealthReportEntry[]): Promise<string> {
        let csv = 'time,spec,interface,status,region,message\n';
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
        console.error('ParseMessageFromHealthV2 - failed parsing data:', e);
        return "";
    }
}

export async function ProviderHealthPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderHealthData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply);
}

export async function ProviderHealthItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).getTotalItemCountPaginatiedHandler(request, reply)
}

export async function ProviderHealthCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).CSVRequestHandler(request, reply);
}