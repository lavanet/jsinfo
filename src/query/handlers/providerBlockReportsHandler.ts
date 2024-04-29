
// src/query/handlers/providerBlockReportsHandler.ts

// curl http://localhost:8081/providerBlockReports/lava@1tlkpa7t48fjl7qan4ete6xh0lsy679flnqdw57

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest } from '../utils/queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CompareValues } from '../utils/queryUtils';

export interface BlockReportsReponse {
    id: number;
    blockId: number;
    tx: string;
    timestamp: string;
    chainId: string;
    chainBlockHeight: number;
}

export const ProviderBlockReportsHandlerOpts: RouteShorthandOptions = {
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
                                id: {
                                    type: 'number'
                                },
                                blockId: {
                                    type: 'number'
                                },
                                tx: {
                                    type: 'string'
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time'
                                },
                                chainId: {
                                    type: 'string'
                                },
                                chainBlockHeight: {
                                    type: 'number'
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class ProviderBlockReportsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderBlockReportsData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<BlockReportsReponse[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerLatestBlockReports).
            where(
                and(
                    eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr),
                    gte(JsinfoSchema.providerLatestBlockReports.timestamp, thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.providerLatestBlockReports.timestamp)).limit(5000);

        return result.map((row: JsinfoSchema.ProviderLatestBlockReports) => ({
            id: row.id,
            blockId: row.blockId ?? 0,
            tx: row.tx ?? '',
            timestamp: row.timestamp?.toISOString() ?? '',
            chainId: row.chainId,
            chainBlockHeight: row.chainBlockHeight ?? 0,
        }));
    }

    private async fetchDataFromCache(): Promise<BlockReportsReponse[]> {
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

    public async getPaginatedItems(pagination: Pagination | null): Promise<BlockReportsReponse[]> {
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

    private sortData(data: BlockReportsReponse[], sortKey: string, direction: 'ascending' | 'descending'): BlockReportsReponse[] {
        if (sortKey === "-" || sortKey === "") sortKey = "timestamp";

        if (sortKey && ["timestamp", "chain_id", "amount"].includes(sortKey)) {
            if (sortKey !== "timestamp" || direction !== "descending") {
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
        let csv = 'timestamp,blockId,tx,chainId,chainBlockHeight\n';
        data.forEach((item: BlockReportsReponse) => {
            csv += `${item.timestamp},${item.blockId},${item.chainId},${item.chainBlockHeight}\n`;
        });
        return csv;
    } v
}

export async function ProviderBlockReportsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerDelegatorRewardsData = new ProviderBlockReportsData(addr);
    const count = await providerDelegatorRewardsData.getTotalItemCount();

    return { itemCount: count };
}

export async function ProviderBlockReportsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    let pagination: Pagination | null = ParsePaginationFromRequest(request)
    const providerBlockReportsData = new ProviderBlockReportsData(addr);
    const res: BlockReportsReponse[] = await providerBlockReportsData.getPaginatedItems(pagination);

    if (!res || res.length === 0 || Object.keys(res).length === 0) {
        console.log(`ProviderBlockReportsHandler:: No health info for provider ${addr} in database.`);
        return { data: [] };
    }

    return { data: res };
}

export async function ProviderBlockReportsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerBlockReportsData = new ProviderBlockReportsData(addr);
    const csv = await providerBlockReportsData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderBlockReports_${addr}.csv`);
    reply.send(csv);
}