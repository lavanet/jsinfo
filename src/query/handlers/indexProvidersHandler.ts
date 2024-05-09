// src/query/handlers/indexProvidersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, desc, inArray, not, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

type IndexProvidersResponse = {
    addr: string,
    moniker: string,
    rewardSum: number,
    totalServices: string,
    totalStake: number,
};

export const IndexProvidersCachedHandlerOpts: RouteShorthandOptions = {
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

class IndexProvidersData extends CachedDiskDbDataFetcher<IndexProvidersResponse> {

    constructor() {
        super("IndexProvidersData");
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `IndexProvidersData`);
    }

    protected getCSVFileName(): string {
        return `LavaTopProviders.csv`;
    }

    public static GetInstance(): IndexProvidersData {
        return IndexProvidersData.GetInstanceBase();
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

    public async getPaginatedItemsImpl(
        data: IndexProvidersResponse[],
        pagination: Pagination | null
    ): Promise<IndexProvidersResponse[] | null> {
        const defaultSortKey = "totalStake";
        const defaultPagination = ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        // Use the provided pagination or the default one
        const finalPagination: Pagination = pagination ?? defaultPagination;

        // If sortKey is null, set it to the defaultSortKey
        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        // Validate sortKey
        const validKeys = ["moniker", "addr", "rewardSum", "totalServices", "totalStake"];
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const sortKey = finalPagination.sortKey as string;
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, finalPagination.direction);
        });

        // Apply pagination
        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        const paginatedData = data.slice(start, end);

        return paginatedData;
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

export async function IndexProvidersCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await IndexProvidersData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function IndexProvidersItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await IndexProvidersData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function IndexProvidersCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await IndexProvidersData.GetInstance().getCSVRawHandler(request, reply)
}