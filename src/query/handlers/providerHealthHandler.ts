
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { eq, desc } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest } from '../utils/queryPagination';
import { CSVEscape, IsNotNullAndNotZero } from '../utils/queryUtils';
import { CompareValues } from '../utils/queryUtils';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
export interface HealthReport {
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

export const ProviderHealthHandlerOpts: RouteShorthandOptions = {
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

class ProviderHealthData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS;

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderHealthHandlerData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<HealthReport[]> {
        let query = createHealthReportQuery(this.addr);
        let res: HealthReport[] = await query;
        return ApplyHealthResponseGroupingAndTextFormatting(res);
    }

    private async fetchDataFromCache(): Promise<HealthReport[]> {
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

    public async getPaginatedItems(pagination: Pagination | null): Promise<HealthReport[]> {
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

    private sortData(data: HealthReport[], sortKey: string, direction: 'ascending' | 'descending'): HealthReport[] {
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

    public async getCSV(): Promise<string> {
        const data = await this.fetchDataFromCache();
        let csv = 'timestamp,spec,interface,status,message\n';
        data.forEach((item: HealthReport) => {
            csv += `${item.timestamp},${CSVEscape(item.spec)},${CSVEscape(item.interface || "")},${CSVEscape(item.status)},${CSVEscape(item.message || "")}\n`;
        });
        return csv;
    }
}

const createHealthReportQuery = (addr: string) => {
    return QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerHealthHourly)
        .where(eq(JsinfoSchema.providerHealthHourly.provider, addr))
        .orderBy(desc(JsinfoSchema.providerHealthHourly.timestamp));
}

const getHealthReportBlocksMessage = (item: HealthReport) => {
    let blockMessage = `Block: 0x${(item.block || 0).toString(16)}`;

    if (item.blocksaway !== null) {
        let latestBlock = (item.block || 0) + item.blocksaway;
        blockMessage += ` / Others: 0x${latestBlock.toString(16)}`;
    }

    return blockMessage;
}

const createHealthReportFormatedMessage = (item: HealthReport): string => {
    let message = item.message || '';

    if (IsNotNullAndNotZero(item.block) || IsNotNullAndNotZero(item.latency)) {
        let latencyInMs = item.latency !== null ? Math.round(item.latency / 1e6) : 0;
        let blockMessage = getHealthReportBlocksMessage(item);

        message = `${blockMessage}, latency: ${latencyInMs} ms`;
    }

    return message;
}

const applyTextFormattingToHealthReportRow = (item: HealthReport): HealthReport => {
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

export const CompareHealthReportByStatusLatency = (a: HealthReport, b: HealthReport) => {
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

export const validateOneProvider = (res: HealthReport[]) => {
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

export const GroupHealthReportBy15MinutesWithSort = (res: HealthReport[]) => {
    validateOneProvider(res);

    const groups = res.reduce((groups: { [key: string]: HealthReport[] }, item: HealthReport) => {
        const timestamp = RoundDateToNearest15Minutes(new Date(item.timestamp)).toISOString();
        const key = `${item.spec}-${item.interface}-${timestamp}`;

        if (!groups[key]) {
            groups[key] = [];
        }

        groups[key].push(item);

        return groups;
    }, {});

    return (Object.values(groups)).map((group: HealthReport[]) => {
        return group.sort(CompareHealthReportByStatusLatency)[0];
    });
}

export const ApplyHealthResponseGroupingAndTextFormatting = (res: HealthReport[]): HealthReport[] => {
    const groupedAndSortedItems = GroupHealthReportBy15MinutesWithSort(res);
    return groupedAndSortedItems.map(applyTextFormattingToHealthReportRow);
}

export async function ProviderHealthItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderHealthData(addr);
    const count = await providerHealthData.getTotalItemCount();

    return { itemCount: count };
}

export async function ProviderHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    let pagination: Pagination | null = ParsePaginationFromRequest(request)
    const providerHealthData = new ProviderHealthData(addr);
    const res: HealthReport[] = await providerHealthData.getPaginatedItems(pagination);

    if (!res || res.length === 0 || Object.keys(res).length === 0) {
        console.log(`ProviderHealthHandler:: No health info for provider ${addr} in database.`);
    }

    return { data: res };
}

export async function ProviderHealthCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderHealthData(addr);
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderHealth_${addr}.csv`);
    reply.send(csv);
}