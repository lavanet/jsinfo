
// src/query/handlers/providerStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { desc, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';

export const ProviderStakesHandlerOpts: RouteShorthandOptions = {
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
                                stake: {
                                    type: 'number'
                                },
                                appliedHeight: {
                                    type: 'number'
                                },
                                geolocation: {
                                    type: 'number'
                                },
                                addons: {
                                    type: 'string'
                                },
                                extensions: {
                                    type: 'string'
                                },
                                status: {
                                    type: 'number'
                                },
                                provider: {
                                    type: 'string'
                                },
                                specId: {
                                    type: 'string'
                                },
                                blockId: {
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


class ProviderStakesData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderStakesData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<any[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let stakesRes = await GetReadDbInstance().select().from(schema.providerStakes).
            where(eq(schema.providerStakes.provider, this.addr)).orderBy(desc(schema.providerStakes.stake))

        return stakesRes;
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

        let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("specId,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "specId";


        // Validate sortKey
        const validKeys = ["specId", "status", "geolocation", "addons", "extensions", "stake"];
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
            { key: "specId", name: "Spec" },
            { key: "status", name: "Status" },
            { key: "geolocation", name: "Geolocation" },
            { key: "addons", name: "Addons" },
            { key: "extensions", name: "Extensions" },
            { key: "stake", name: "Stake" },
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

export async function ProviderStakesHandler(request: FastifyRequest, reply: FastifyReply) {
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

    const providerStakesData = new ProviderStakesData(addr);
    try {
        const data = await providerStakesData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderStakesItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
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

    const providerStakesData = new ProviderStakesData(addr);
    const itemCount = await providerStakesData.getTotalItemCount();
    return { itemCount: itemCount }
}

export async function ProviderStakesCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderStakesData(addr);
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderStakes_${addr}.csv`);
    reply.send(csv);
}
