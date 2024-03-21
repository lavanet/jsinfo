
// src/query/handlers/providerReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';

export const ProviderReportsHandlerOpts: RouteShorthandOptions = {
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
                                provider_reported: {
                                    type: 'object',
                                    properties: {
                                        provider: {
                                            type: 'string'
                                        },
                                        blockId: {
                                            type: 'number'
                                        },
                                        cu: {
                                            type: 'number'
                                        },
                                        disconnections: {
                                            type: 'number'
                                        },
                                        epoch: {
                                            type: 'number'
                                        },
                                        errors: {
                                            type: 'number'
                                        },
                                        project: {
                                            type: 'string'
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        },
                                        totalComplaintEpoch: {
                                            type: 'number'
                                        },
                                        tx: {
                                            type: 'string'
                                        }
                                    }
                                },
                                blocks: {
                                    type: 'object',
                                    properties: {
                                        height: {
                                            type: 'number'
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class ProviderReportsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderReportsData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<any[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let reportsRes = await GetReadDbInstance().select().from(schema.providerReported).
            leftJoin(schema.blocks, eq(schema.providerReported.blockId, schema.blocks.height)).
            where(
                and(
                    eq(schema.providerReported.provider, this.addr),
                    gte(schema.blocks['datetime'], thirtyDaysAgo)
                )
            ).
            orderBy(desc(schema.blocks['datetime'])).limit(5000);
        return reportsRes;
    }

    private async fetchDataFromCache(): Promise<any[]> {
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

    public async getPaginatedItems(request: FastifyRequest): Promise<{ data: any[] }> {
        let data = await this.fetchDataFromCache();

        let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("blocks.datetime,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "blocks.datetime";

        // Validate sortKey
        const validKeys = ["provider_reported.blockId", "blocks.datetime", "provider_reported.cu", "provider_reported.disconnections", "provider_reported.errors", "provider_reported.project"];
        if (!validKeys.includes(pagination.sortKey)) {
            throw new Error('Invalid sort key');
        }

        // Apply sorting
        const sortKeyParts = pagination.sortKey.split('.');
        data.sort((a, b) => {
            const aValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, a);
            const bValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, b);

            if (pagination.direction === 'ascending') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return { data: data };
    }

    public async getTotalItemCount(): Promise<number> {
        const data = await this.fetchDataFromCache();
        return data.length;
    }

    public async getCSV(): Promise<string> {
        const data = await this.fetchDataFromCache();
        const columns = [
            { key: "provider_reported.blockId", name: "Block" },
            { key: "blocks.datetime", name: "Time" },
            { key: "provider_reported.cu", name: "CU" },
            { key: "provider_reported.disconnections", name: "Disconnections" },
            { key: "provider_reported.errors", name: "Errors" },
            { key: "provider_reported.project", name: "Project" },
        ];

        let csv = columns.map(column => this.escape(column.name)).join(',') + '\n';

        data.forEach((item: any) => {
            csv += columns.map(column => {
                const keys = column.key.split('.');
                const value = keys.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : '', item);
                return this.escape(String(value));
            }).join(',') + '\n';
        });

        return csv;
    }

    private escape(str: string): string {
        return `"${str.replace(/"/g, '""')}"`;
    }

}

export async function ProviderReportsHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const providerReportsData = new ProviderReportsData(addr);
    try {
        const data = await providerReportsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderReportsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await GetReadDbInstance().select().from(schema.providers).where(eq(schema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const providerReportsData = new ProviderReportsData(addr);
    const itemCount = await providerReportsData.getTotalItemCount();
    return { itemCount: itemCount }
}

export async function ProviderReportsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderReportsData(addr);
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderReports_${addr}.csv`);
    reply.send(csv);
}