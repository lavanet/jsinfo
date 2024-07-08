// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, desc, inArray, not, eq, isNull, and } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetDataLength, SafeSlice } from '../utils/queryUtils';
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

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `IndexProvidersData`);
    }

    protected getCSVFileNameImpl(): string {
        return `LavaTopProviders.csv`;
    }

    public static GetInstance(): IndexProvidersData {
        return IndexProvidersData.GetInstanceBase();
    }

    protected async fetchDataFromDb(): Promise<IndexProvidersResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const res = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            totalServices: sql<string>`concat(sum(case when ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} then 1 else 0 end), ' / ', count(${JsinfoSchema.providerStakes.specId}))`,
            totalStake: sql<number>`sum(${JsinfoSchema.providerStakes.stake})`,
            rewardSum: sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`,
            moniker: JsinfoSchema.providers.moniker,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoSchema.aggHourlyrelayPayments, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.aggHourlyrelayPayments.provider))
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
            .where(
                and(
                    not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                    not(isNull(JsinfoSchema.providerStakes.provider)),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            )
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.moniker)
            .orderBy(desc(sql<number>`sum(${JsinfoSchema.aggHourlyrelayPayments.rewardSum})`))

        const providersDetails: IndexProvidersResponse[] = res.map(provider => ({
            addr: provider.provider || "",
            moniker: provider.moniker || "",
            rewardSum: provider.rewardSum || 0,
            totalServices: provider.totalServices!,
            totalStake: provider.totalStake,
        }));

        return providersDetails;
    }

    public async getPaginatedItemsImpl(
        data: IndexProvidersResponse[],
        pagination: Pagination | null
    ): Promise<IndexProvidersResponse[] | null> {
        const defaultSortKey = "totalStake";

        let finalPagination: Pagination;

        if (pagination) {
            finalPagination = pagination;
        } else {
            finalPagination = ParsePaginationFromString(
                `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
            );
        }

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
        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
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
    return await IndexProvidersData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function IndexProvidersItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function IndexProvidersCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().getCSVRawHandler(request, reply)
}