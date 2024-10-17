// src/query/handlers/indexProvidersActiveHandler.ts

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

type IndexProvidersActiveResponse = {
    provider: string,
    moniker: string,
    monikerfull: string,
    rewardSum: number,
    totalServices: string,
    totalStake: string,
};

export const IndexProvidersActivePaginatedHandlerOpts: RouteShorthandOptions = {
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

class IndexProvidersActiveData extends RequestHandlerBase<IndexProvidersActiveResponse> {

    constructor() {
        super("IndexProvidersActive");
    }

    public static GetInstance(): IndexProvidersActiveData {
        return IndexProvidersActiveData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `LavaActiveProviders.csv`;
    }

    async fetchAllRecords(): Promise<IndexProvidersActiveResponse[]> {
        // console.time('fetchAllRecords');

        await QueryCheckJsinfoReadDbInstance();

        const query = QueryGetJsinfoReadDbInstance()
            .select({
                provider: JsinfoSchemaProviderMaterialViews.activeProviders.provider,
                lastActive: JsinfoSchemaProviderMaterialViews.activeProviders.lastActive,
                totalRelays: JsinfoSchemaProviderMaterialViews.activeProviders.totalRelays,
                totalServices: JsinfoSchemaProviderMaterialViews.activeProviders.totalServices,
                totalStake: JsinfoSchemaProviderMaterialViews.activeProviders.totalStake,
                rewardSum: JsinfoSchemaProviderMaterialViews.activeProviders.rewardSum,
                moniker: JsinfoSchemaProviderMaterialViews.activeProviders.moniker
            })
            .from(JsinfoSchemaProviderMaterialViews.activeProviders)
            .orderBy(desc(JsinfoSchemaProviderMaterialViews.activeProviders.totalStake));

        const result = await query;

        // console.timeEnd('fetchAllRecords');
        return this.mapResultToResponse(result);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<IndexProvidersActiveResponse[]> {
        const defaultSortKey = "totalStake";
        const finalPagination = pagination || ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        finalPagination.sortKey = finalPagination.sortKey || defaultSortKey;

        const keyToColumnMap = {
            provider: JsinfoSchemaProviderMaterialViews.activeProviders.provider,
            lastActive: JsinfoSchemaProviderMaterialViews.activeProviders.lastActive,
            totalRelays: JsinfoSchemaProviderMaterialViews.activeProviders.totalRelays,
            totalServices: JsinfoSchemaProviderMaterialViews.activeProviders.totalServices,
            totalStake: JsinfoSchemaProviderMaterialViews.activeProviders.totalStake,
            rewardSum: JsinfoSchemaProviderMaterialViews.activeProviders.rewardSum,
            moniker: JsinfoSchemaProviderMaterialViews.activeProviders.moniker
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
            .from(JsinfoSchemaProviderMaterialViews.activeProviders)
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        return this.mapResultToResponse(res);
    }

    async fetchRecordCountFromDb(): Promise<number> {
        // console.time('fetchRecordCountFromDb');
        await QueryCheckJsinfoReadDbInstance();

        const result = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`count(*)`
            })
            .from(JsinfoSchemaProviderMaterialViews.activeProviders)

        // console.timeEnd('fetchRecordCountFromDb');
        return result[0]?.count ?? 0;
    }

    private mapResultToResponse(result: any[]): IndexProvidersActiveResponse[] {
        return result.map(row => ({
            provider: row.provider,
            lastActive: row.lastActive,
            totalRelays: Number(row.totalRelays),
            totalServices: row.totalServices,
            totalStake: row.totalStake,
            rewardSum: Number(row.rewardSum),
            moniker: row.moniker,
            monikerfull: MonikerCache.GetMonikerFullDescription(row.provider)
        }));
    }

    protected async convertRecordsToCsv(data: IndexProvidersActiveResponse[]): Promise<string> {
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

export async function IndexProvidersActivePaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersActiveData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function IndexProvidersActiveItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersActiveData.GetInstance().getTotalItemCountPaginatedHandler(request, reply)
}

export async function IndexProvidersActiveCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersActiveData.GetInstance().CSVRequestHandler(request, reply)
}
