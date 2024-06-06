
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { eq, desc } from "drizzle-orm";
import { Pagination } from '../utils/queryPagination';
import { CSVEscape, GetAndValidateProviderAddressFromRequest, GetDataLengthForPrints, IsNotNullAndNotZero } from '../utils/queryUtils';
import { CompareValues } from '../utils/queryUtils';
import path from 'path';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export interface HealthReportResponse {
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
}

export const ProviderHealthCachedHandlerOpts: RouteShorthandOptions = {
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
                            }
                        }
                    }
                }
            }
        }
    }
}

class ProviderHealthData extends CachedDiskDbDataFetcher<HealthReportResponse> {
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

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderHealthHandlerData_${this.addr}`);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderHealth_${this.addr}.csv`;
    }

    protected async fetchDataFromDb(): Promise<HealthReportResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let query = createHealthReportQuery(this.addr);
        let res: HealthReportResponse[] = await query;
        return ApplyHealthResponseGroupingAndTextFormatting(res);
    }

    public async getPaginatedItemsImpl(data: HealthReportResponse[], pagination: Pagination | null): Promise<HealthReportResponse[] | null> {

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

    private sortData(data: HealthReportResponse[], sortKey: string, direction: 'ascending' | 'descending'): HealthReportResponse[] {
        if (sortKey === "-" || sortKey === "") sortKey = "timestamp";

        if (!["timestamp", "spec", "interface", "status", "message"].includes(sortKey)) {
            console.log(`Invalid sortKey: ${sortKey}`);
            sortKey = "timestamp"
        }

        return data.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, direction);
        });
    }

    public async getCSVImpl(data: HealthReportResponse[]): Promise<string> {
        let csv = 'time,spec,interface,status,message\n';
        data.forEach((item: HealthReportResponse) => {
            csv += `${item.timestamp},${CSVEscape(item.spec)},${CSVEscape(item.interface || "")},${CSVEscape(item.status)},${CSVEscape(item.message || "")}\n`;
        });
        return csv;
    }
}

const createHealthReportQuery = (addr: string) => {
    return QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerHealthHourly)
        .where(eq(JsinfoSchema.providerHealthHourly.provider, addr))
        .orderBy(desc(JsinfoSchema.providerHealthHourly.timestamp))
        .offset(0)
        .limit(10000); // JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);
}

const getHealthReportBlocksMessage = (item: HealthReportResponse) => {
    let blockMessage = `Block: 0x${(item.block || 0).toString(16)}`;

    if (item.blocksaway !== null) {
        let latestBlock = (item.block || 0) + item.blocksaway;
        blockMessage += ` / Others: 0x${latestBlock.toString(16)}`;
    }

    return blockMessage;
}

const createHealthReportFormatedMessage = (item: HealthReportResponse): string => {
    let message = item.message || '';

    if (IsNotNullAndNotZero(item.block) || IsNotNullAndNotZero(item.latency)) {
        let latencyInMs = item.latency !== null ? Math.round(item.latency / 1e6) : 0;
        let blockMessage = getHealthReportBlocksMessage(item);

        message = `${blockMessage}, latency: ${latencyInMs} ms`;
    }

    return message;
}

const applyTextFormattingToHealthReportRow = (item: HealthReportResponse): HealthReportResponse => {
    const message = createHealthReportFormatedMessage(item);
    item.message = message;
    return item;
}

export const RoundDateToNearest15Minutes = (date: Date) => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 15) * 15;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), roundedMinutes);
}

const healthReportsStatusCompareOrder = ['healthy', 'unhealthy', 'frozen'];

export const CompareHealthReportByStatusLatency = (a: HealthReportResponse, b: HealthReportResponse) => {
    const aStatusIndex = healthReportsStatusCompareOrder.indexOf(a.status);
    const bStatusIndex = healthReportsStatusCompareOrder.indexOf(b.status);

    if (aStatusIndex === -1 || bStatusIndex === -1) {
        throw new Error(`Invalid status. Status must be one of: ${healthReportsStatusCompareOrder.join(', ')}`);
    }

    if (aStatusIndex > bStatusIndex) {
        return 1;
    } else if (aStatusIndex < bStatusIndex) {
        return -1;
    }

    if (a.latency !== null && b.latency !== null) {
        if (a.latency > b.latency) {
            return 1;
        } else if (a.latency < b.latency) {
            return -1;
        }
    }

    const latestBlockA = (a.block || 0) + (a.blocksaway || 0);
    const latestBlockB = (b.block || 0) + (b.blocksaway || 0);

    if (latestBlockA > latestBlockB) {
        return 1;
    } else if (latestBlockA < latestBlockB) {
        return -1;
    }

    const messageComparison = (a.message || "").localeCompare(b.message || "");
    if (messageComparison > 0) {
        return 1;
    } else if (messageComparison < 0) {
        return -1;
    }

    return 0;
}

export const validateOneProvider = (res: HealthReportResponse[]) => {
    if (res.length === 0) {
        return;
    }

    const provider = res[0].provider;

    if (provider === null) {
        throw new Error('Provider is null');
    }

    for (const item of res) {
        if (item.provider !== provider) {
            throw new Error('Not all items have the same provider');
        }
    }
}

export const GroupHealthReportBy15MinutesWithSort = (res: HealthReportResponse[]) => {
    validateOneProvider(res);

    const groups = res.reduce((groups: { [key: string]: HealthReportResponse[] }, item: HealthReportResponse) => {
        const timestamp = RoundDateToNearest15Minutes(new Date(item.timestamp)).toISOString();
        const key = `${item.spec}-${item.interface}-${timestamp}`;

        if (!groups[key]) {
            groups[key] = [];
        }

        groups[key].push(item);

        return groups;
    }, {});

    return (Object.values(groups)).map((group: HealthReportResponse[]) => {
        return group.sort(CompareHealthReportByStatusLatency)[0];
    });
}

export const ApplyHealthResponseGroupingAndTextFormatting = (res: HealthReportResponse[]): HealthReportResponse[] => {
    const groupedAndSortedItems = GroupHealthReportBy15MinutesWithSort(res);
    return groupedAndSortedItems.map(applyTextFormattingToHealthReportRow);
}

export async function ProviderHealthCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderHealthData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply);
}

export async function ProviderHealthItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderHealthCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderHealthData.GetInstance(addr).getCSVRawHandler(request, reply);
}
