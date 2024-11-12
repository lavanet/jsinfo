// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, not, eq, asc, and, isNull } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../../queryConsts';
import { CSVEscape } from '../../utils/queryUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { MonikerCache } from '../../classes/QueryProviderMonikerCache';

const rewardSumSubQuery = sql`SELECT SUM(arp_sub.rewardSum) FROM(SELECT arp."provider", SUM(arp."rewardsum") AS rewardSum FROM ${JsinfoProviderAgrSchema.aggAllTimeRelayPayments} arp GROUP BY arp."provider") arp_sub WHERE arp_sub."provider" = ${JsinfoSchema.providerStakes.provider}`

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
        super("IndexProvidersData");
    }

    public static GetInstance(): IndexProvidersData {
        return IndexProvidersData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `LavaTopProviders.csv`;
    }

    protected async fetchAllRecords(): Promise<IndexProvidersResponse[]> {
        await QueryCheckJsinfoDbInstance();

        const res = await QueryGetJsinfoDbForQueryInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
            totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
            rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
        }).from(JsinfoSchema.providerStakes)
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            )
            .groupBy(JsinfoSchema.providerStakes.provider)
            .orderBy(sql`rewardSum DESC`)

        const providersDetails: IndexProvidersResponse[] = res.map(provider => ({
            provider: provider.provider || "",
            moniker: MonikerCache.GetMonikerForProvider(provider.provider),
            monikerfull: MonikerCache.GetMonikerFullDescription(provider.provider),
            rewardSum: provider.rewardSum,
            totalServices: provider.totalServices || "",
            totalStake: provider.totalStake.toString(),
        }));

        return providersDetails;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoDbInstance();

        const res = await QueryGetJsinfoDbForQueryInstance()
            .select({
                count: sql<number>`COUNT(DISTINCT ${JsinfoSchema.providerStakes.provider})`
            })
            .from(JsinfoSchema.providerStakes)
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            );

        return res[0].count || 0;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<IndexProvidersResponse[]> {
        const defaultSortKey = "totalStake";

        let finalPagination: Pagination;

        if (pagination) {
            finalPagination = pagination;
        } else {
            finalPagination = ParsePaginationFromString(
                `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
            );
        }

        // Ensure the sort key is valid or use the default
        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        // Define the key-to-column mapping based on the schema provided
        const keyToColumnMap = {
            provider: JsinfoSchema.providerStakes.provider,
            moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker})`,
            rewardSum: sql`rewardSum`,
            totalServices: sql`totalServices`,
            totalStake: sql`totalStake`
        };

        // Check if the sort key is in the map, throw an error if not
        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        if (sortColumn === keyToColumnMap["moniker"]) {
            // Execute the query with proper sorting, pagination using offset and limit
            const data = await QueryGetJsinfoDbForQueryInstance()
                .select({
                    provider: JsinfoSchema.providerStakes.provider,
                    moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker}) as moniker`,
                    totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                    totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
                    rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                })
                .from(JsinfoSchema.providerStakes)
                .leftJoin(JsinfoSchema.providerSpecMoniker, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerSpecMoniker.provider))
                .where(
                    and(
                        and(
                            not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                            not(isNull(JsinfoSchema.providerStakes.provider)),
                        ),
                        not(eq(JsinfoSchema.providerStakes.provider, ''))
                    )
                )
                .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerSpecMoniker.moniker)
                .orderBy(orderFunction(sortColumn))
                .offset((finalPagination.page - 1) * finalPagination.count)
                .limit(finalPagination.count);

            return data.map(item => ({
                provider: item.provider || "",
                moniker: MonikerCache.GetMonikerForProvider(item.provider),
                monikerfull: MonikerCache.GetMonikerFullDescription(item.provider),
                rewardSum: item.rewardSum || 0,
                totalServices: item.totalServices,
                totalStake: item.totalStake.toString()
            }));
        }

        const data = await QueryGetJsinfoDbForQueryInstance()
            .select({
                provider: JsinfoSchema.providerStakes.provider,
                totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
                rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
            })
            .from(JsinfoSchema.providerStakes)
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            )
            .groupBy(JsinfoSchema.providerStakes.provider)
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        return data.map(item => ({
            provider: item.provider || "",
            moniker: MonikerCache.GetMonikerForProvider(item.provider),
            monikerfull: MonikerCache.GetMonikerFullDescription(item.provider),
            rewardSum: item.rewardSum || 0,
            totalServices: item.totalServices,
            totalStake: item.totalStake.toString()
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