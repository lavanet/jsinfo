
// src/query/handlers/providerRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';

export const ProviderRewardsHandlerOpts: RouteShorthandOptions = {
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
                                relay_payments: {
                                    type: 'object',
                                    properties: {
                                        id: {
                                            type: 'number'
                                        },
                                        relays: {
                                            type: 'number'
                                        },
                                        cu: {
                                            type: 'number'
                                        },
                                        pay: {
                                            type: ['number', 'null']
                                        },
                                        datetime: {
                                            type: 'string',
                                            format: 'date-time'
                                        },
                                        qosSync: {
                                            type: 'number'
                                        },
                                        qosAvailability: {
                                            type: 'number'
                                        },
                                        qosLatency: {
                                            type: 'number'
                                        },
                                        qosSyncExc: {
                                            type: 'number'
                                        },
                                        qosAvailabilityExc: {
                                            type: 'number'
                                        },
                                        qosLatencyExc: {
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
                                        },
                                        consumer: {
                                            type: 'string'
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


class ProviderRewardsData {
    private addr: string;
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor(addr: string) {
        this.addr = addr;
    }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderRewardsData_${this.addr}`);
    }

    private async fetchDataFromDb(): Promise<any[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const paymentsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.relayPayments).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.relayPayments.provider, this.addr),
                    gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                )).
            orderBy(desc(JsinfoSchema.relayPayments.id)).offset(0).limit(5000)

        return paymentsRes;
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

        let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("relay_payments.id,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "relay_payments.id";


        // Validate sortKey
        const validKeys = ["relay_payments.specId", "relay_payments.blockId", "blocks.datetime", "relay_payments.consumer", "relay_payments.relays", "relay_payments.cu", "relay_payments.qosSync", "relay_payments.qosSyncExc"];
        if (!validKeys.includes(pagination.sortKey)) {
            throw new Error('Invalid sort key');
        }

        // Apply sorting
        const sortKeyParts = pagination.sortKey.split('.');
        data.sort((a, b) => {
            const aValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, a);
            const bValue = sortKeyParts.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : null, b);
            return CompareValues(aValue, bValue, pagination.direction);
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
            { key: "relay_payments.specId", name: "Spec" },
            { key: "relay_payments.blockId", name: "Block" },
            { key: "blocks.datetime", name: "Time" },
            { key: "relay_payments.consumer", name: "Consumer" },
            { key: "relay_payments.relays", name: "Relays" },
            { key: "relay_payments.cu", name: "CU" },
            { key: "relay_payments.qosSync", name: "QoS" },
            { key: "relay_payments.qosSyncExc", name: "Excellence" },
        ];

        let csv = columns.map(column => CSVEscape(column.name)).join(',') + '\n';

        data.forEach((item: any) => {
            csv += columns.map(column => {
                const keys = column.key.split('.');
                const value = keys.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : '', item);
                return CSVEscape(String(value));
            }).join(',') + '\n';
        });

        return csv;
    }
}

export async function ProviderRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const providerRewardsData = new ProviderRewardsData(addr);
    try {
        const data = await providerRewardsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1)
    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return;
    }

    const providerRewardsData = new ProviderRewardsData(addr);
    const itemCount = await providerRewardsData.getTotalItemCount();
    return { itemCount: itemCount }
}

export async function ProviderRewardsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const providerHealthData = new ProviderRewardsData(addr);
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderRewards_${addr}.csv`);
    reply.send(csv);
}
