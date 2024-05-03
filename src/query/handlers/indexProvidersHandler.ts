// src/query/handlers/indexProvidersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, inArray, not, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_CACHEDIR, JSINFO_QUERY_CACHE_ENABLED, JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';


export const IndexProvidersHandlerOpts: RouteShorthandOptions = {
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
                                addr: {
                                    type: 'string'
                                },
                                moniker: {
                                    type: 'string'
                                },
                                rewardSum: {
                                    type: ['number', 'null', 'string']
                                },
                                totalServices: {
                                    type: 'string'
                                },
                                totalStake: {
                                    type: ['number', 'string']
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

class IndexProvidersData {
    private cacheDir: string = JSINFO_QUERY_CACHEDIR;
    private cacheAgeLimit: number = JSINFO_QUERY_HANDLER_CACHE_TIME_SECONDS; // 15 minutes in seconds

    constructor() { }

    private getCacheFilePath(): string {
        return path.join(this.cacheDir, `IndexProvidersData`);
    }

    private async fetchDataFromDb(): Promise<any[]> {
        let res4 = await QueryGetJsinfoReadDbInstance().select({
            address: JsinfoSchema.aggHourlyrelayPayments.provider,
            rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
        }).from(JsinfoSchema.aggHourlyrelayPayments).
            groupBy(JsinfoSchema.aggHourlyrelayPayments.provider).
            orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`))
        let providersAddrs: string[] = []
        res4.map((provider) => {
            providersAddrs.push(provider.address!)
        })

        if (providersAddrs.length == 0) {
            throw new Error('Providers do not exist');
        }

        // provider details
        let res44 = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(inArray(JsinfoSchema.providers.address, providersAddrs))
        let providerStakesRes = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            totalActiveServices: sql<number>`sum(case when ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} then 1 else 0 end)`,
            totalServices: sql<number>`count(${JsinfoSchema.providerStakes.specId})`,
            totalStake: sql<number>`sum(${JsinfoSchema.providerStakes.stake})`,
        }).from(JsinfoSchema.providerStakes)
            .where(not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)))
            .groupBy(JsinfoSchema.providerStakes.provider);

        type ProviderDetails = {
            addr: string,
            moniker: string,
            rewardSum: number,
            totalServices: string,
            totalStake: number,
        };
        let providersDetails: ProviderDetails[] = []
        res4.forEach((provider) => {
            let moniker = ''
            let totalServices = '0'
            let totalStake = 0;
            let tmp1 = res44.find((el) => el.address == provider.address)
            if (tmp1) {
                moniker = tmp1.moniker!
            }
            let tmp2 = providerStakesRes.find((el) => el.provider == provider.address)
            if (tmp2) {
                totalServices = `${tmp2.totalActiveServices} / ${tmp2.totalServices}`
                totalStake = tmp2.totalStake
            }
            providersDetails.push({
                addr: provider.address!,
                moniker: moniker,
                rewardSum: provider.rewardSum,
                totalServices: totalServices,
                totalStake: totalStake,
            })
        })

        return providersDetails;
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

        const defaultSortKey = "totalStake";

        let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("totalStake,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = defaultSortKey;


        // Validate sortKey
        const validKeys = ["moniker", "addr", "rewardSum", "totalServices", "totalStake"];
        if (!validKeys.includes(pagination.sortKey)) {
            throw new Error('Invalid sort key');
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = a[pagination.sortKey || defaultSortKey];
            const bValue = b[pagination.sortKey || defaultSortKey];
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
            { key: "moniker", name: "Moniker" },
            { key: "addr", name: "Provider Address" },
            { key: "rewardSum", name: "Total Rewards" },
            { key: "totalServices", name: "Total Services", },
            { key: "totalStake", name: "Total Stake" },
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

export async function IndexProvidersHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providerRewardsData = new IndexProvidersData();
    try {
        const data = await providerRewardsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function IndexProvidersItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providerRewardsData = new IndexProvidersData();
    const itemCount = await providerRewardsData.getTotalItemCount();
    return { itemCount: itemCount }
}

export async function IndexProvidersCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providerHealthData = new IndexProvidersData();
    const csv = await providerHealthData.getCSV();

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=LavaTopProviders.csv`);
    reply.send(csv);
}
