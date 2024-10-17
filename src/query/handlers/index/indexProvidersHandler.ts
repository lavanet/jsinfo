// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { asc, desc, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../../queryConsts';
import { CSVEscape } from '../../utils/queryUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { MonikerCache } from '../../classes/QueryProviderMonikerCache';
import * as JsinfoSchemaProviderMaterialViews from '../../../schemas/jsinfoSchema/providerMaterialViews';

type IndexProvidersResponse = {
    provider: string,
    moniker: string,
    monikerfull: string,
    rewardSum: number,
    totalServices: string,
    totalStake: string,
};

export const IndexProvidersPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                provider: {
                                    type: 'string'
                                },
                                moniker: {
                                    type: 'string'
                                },
                                monikerfull: {
                                    type: 'string'
                                },
                                rewardSum: {
                                    type: ['number', 'null', 'string']
                                },
                                totalServices: {
                                    type: 'string'
                                },
                                totalStake: {
                                    type: ['null', 'string']
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

class IndexProvidersData extends RequestHandlerBase<IndexProvidersResponse> {

    constructor() {
        super("IndexProviders");
    }

    public static GetInstance(): IndexProvidersData {
        return IndexProvidersData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `LavaProviders.csv`;
    }

    async fetchAllRecords(): Promise<IndexProvidersResponse[]> {
        // console.time('fetchAllRecords');

        await QueryCheckJsinfoReadDbInstance();

        const query = QueryGetJsinfoReadDbInstance()
            .select({
                provider: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.provider,
                lastActive: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.lastActive,
                totalRelays: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalRelays,
                totalServices: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalServices,
                totalStake: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalStake,
                rewardSum: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.rewardSum,
                moniker: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.moniker
            })
            .from(JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders)
            .orderBy(desc(JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalStake));

        const result = await query;

        // console.timeEnd('fetchAllRecords');
        return this.mapResultToResponse(result);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<IndexProvidersResponse[]> {
        const defaultSortKey = "totalStake";
        const finalPagination = pagination || ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        finalPagination.sortKey = finalPagination.sortKey || defaultSortKey;

        const keyToColumnMap = {
            provider: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.provider,
            lastActive: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.lastActive,
            totalRelays: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalRelays,
            totalServices: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalServices,
            totalStake: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.totalStake,
            rewardSum: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.rewardSum,
            moniker: JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders.moniker
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const res = await QueryGetJsinfoReadDbInstance()
            .select(keyToColumnMap)
            .from(JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders)
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        return this.mapResultToResponse(res);
    }

    async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const result = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`count(*)`
            })
            .from(JsinfoSchemaProviderMaterialViews.activeAndInactiveProviders)

        return result[0]?.count ?? 0;
    }

    private mapResultToResponse(result: any[]): IndexProvidersResponse[] {
        return result.map(row => ({
            provider: row.provider,
            totalRelays: Number(row.totalRelays),
            totalServices: row.totalServices,
            totalStake: row.totalStake,
            rewardSum: Number(row.rewardSum),
            moniker: row.moniker,
            monikerfull: MonikerCache.GetMonikerFullDescription(row.provider)
        }));
    }

    protected async convertRecordsToCsv(data: IndexProvidersResponse[]): Promise<string> {
        const columns = [
            { key: "moniker", name: "Moniker" },
            { key: "provider", name: "Provider Address" },
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

export async function IndexProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function IndexProvidersItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().getTotalItemCountPaginatedHandler(request, reply)
}

export async function IndexProvidersCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().CSVRequestHandler(request, reply)
}
