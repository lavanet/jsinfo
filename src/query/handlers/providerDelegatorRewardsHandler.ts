
// src/query/handlers/providerDelegatorRewardsHandler.ts

// curl http://localhost:8081/providerDelegatorRewards/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge

import fs from 'fs';
import path from 'path';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { eq, desc } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest } from '../utils/queryPagination';
import { CompareValues } from '../utils/queryUtils';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS } from '../queryConsts';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';

export interface DelegatorRewardReponse {
    id: number;
    timestamp: string;
    chain_id: string;
    amount: string;
}

export const ProviderDelegatorRewardsHandlerOpts: RouteShorthandOptions = {
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
                                timestamp: { type: 'string' },
                                chain_id: { type: 'string' },
                                amount: { type: 'string' },
                            }
                        }
                    }
                }
            }
        }
    }
}

class ProviderDelegatorRewardsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS;

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderDelegatorRewardsHandlerData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<DelegatorRewardReponse[]> {
        const result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr))
            .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp)).offset(0).limit(5000)

        return result.map((row: JsinfoSchema.DualStackingDelegatorRewards) => ({
            id: row.id,
            timestamp: row.timestamp?.toISOString(),
            chain_id: row.chain_id,
            amount: row.amount + " " + row.denom
        }));
    }

    private async fetchDataFromCache(): Promise<DelegatorRewardReponse[]> {
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

    public async getPaginatedItems(pagination: Pagination | null): Promise<DelegatorRewardReponse[]> {
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

    private sortData(data: DelegatorRewardReponse[], sortKey: string, direction: 'ascending' | 'descending'): DelegatorRewardReponse[] {
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
        let csv = 'timestamp,chain_id,amount\n';
        data.forEach((item: DelegatorRewardReponse) => {
            csv += `${item.timestamp},${item.chain_id},${item.amount}\n`;
        });
        return csv;
    }
}

export async function ProviderDelegatorRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    const count = await providerDelegatorRewardsData.getTotalItemCount();

    return { itemCount: count };
}

export async function ProviderDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    let pagination: Pagination | null = ParsePaginationFromRequest(request)
    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    const res: DelegatorRewardReponse[] = await providerDelegatorRewardsData.getPaginatedItems(pagination);

    if (!res || res.length === 0 || Object.keys(res).length === 0) {
        console.log(`ProviderDelegatorRewardsHandler:: No health info for provider ${addr} in database.`);
    }

    return { data: res };
}

export async function ProviderDelegatorRewardsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    const csv = await providerDelegatorRewardsData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderDelegatorRewards_${addr}.csv`);
    reply.send(csv);
}