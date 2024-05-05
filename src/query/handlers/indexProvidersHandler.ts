// src/query/handlers/indexProvidersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { sql, desc, inArray, not, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';
import { CachedDiskPsqlQuery } from '../classes/CachedDiskPsqlQuery';

type IndexProvidersResponse = {
    addr: string,
    moniker: string,
    rewardSum: number,
    totalServices: string,
    totalStake: number,
};

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

class IndexProvidersData extends CachedDiskPsqlQuery<IndexProvidersResponse> {

    constructor() {
        super();
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `IndexProvidersData`);
    }

    protected async fetchDataFromDb(): Promise<IndexProvidersResponse[]> {
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

        let providersDetails: IndexProvidersResponse[] = []
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

    public async getPaginatedItemsImpl(data: IndexProvidersResponse[], pagination: Pagination | null): Promise<IndexProvidersResponse[] | null> {
        const defaultSortKey = "totalStake";

        pagination = pagination || ParsePaginationFromString(defaultSortKey + ",descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = defaultSortKey;


        // Validate sortKey
        const validKeys = ["moniker", "addr", "rewardSum", "totalServices", "totalStake"];
        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = a[pagination.sortKey || defaultSortKey];
            const bValue = b[pagination.sortKey || defaultSortKey];
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
    }

    public async getCSVImpl(data: IndexProvidersResponse[]): Promise<string> {
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
    return providerRewardsData.getTotalItemCount();
}

export async function IndexProvidersCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const providerHealthData = new IndexProvidersData();
    const csv = await providerHealthData.getCSV();

    if (csv === null) {
        return;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=LavaTopProviders.csv`);
    reply.send(csv);
}