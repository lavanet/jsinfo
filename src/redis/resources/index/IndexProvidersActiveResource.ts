// src/query/handlers/indexProvidersActiveHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, desc, eq, asc, inArray } from "drizzle-orm";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { Pagination } from '@jsinfo/query/utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '@jsinfo/query/queryConsts';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';
import { ActiveProvidersService } from './ActiveProvidersResource';
import { queryJsinfo } from '@jsinfo/utils/db';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
const rewardSumSubQuery = sql`SELECT SUM(arp_sub.rewardSum) FROM(SELECT arp."provider", SUM(arp."rewardsum") AS rewardSum FROM ${JsinfoProviderAgrSchema.aggAllTimeRelayPayments} arp GROUP BY arp."provider") arp_sub WHERE arp_sub."provider" = ${JsinfoSchema.providerStakes.provider}`;

export interface IndexProvidersActiveResponse {
    provider: string;
    moniker: string;
    monikerfull: string;
    rewardSum: number;
    totalServices: string;
    totalStake: string;
}

export interface IndexProvidersActiveResourceResponse {
    type: IndexProvidersActiveQueryType;
    data?: IndexProvidersActiveResponse[];
    count?: number;
}

export type IndexProvidersActiveQueryType = 'all' | 'count' | 'paginated';

export interface IndexProvidersActiveQueryParams {
    type?: IndexProvidersActiveQueryType;
    pagination?: Pagination | null;
}

export class IndexProvidersActiveResource extends RedisResourceBase<IndexProvidersActiveResourceResponse, IndexProvidersActiveQueryParams> {
    protected readonly redisKey = 'index:providers:active';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    protected async getActiveProviderAddresses(): Promise<string[]> {
        const result = await ActiveProvidersService.fetch();
        if (!result) {
            throw new Error("No active providers found");
        }
        return result;
    }

    protected getDefaultParams(): IndexProvidersActiveQueryParams {
        return {
            type: 'paginated',
            pagination: null
        };
    }

    protected async fetchFromSource(params?: IndexProvidersActiveQueryParams): Promise<IndexProvidersActiveResourceResponse> {
        console.time('redis/resources/index/IndexProvidersActiveResource.fetchFromSource');
        try {
            const queryParams = params || this.getDefaultParams();
            const queryType = queryParams.type || 'paginated';

            switch (queryType) {
                case 'all':
                    return {
                        type: 'all',
                        data: await this.fetchAllRecords()
                    };
                case 'paginated':
                    return {
                        type: 'paginated',
                        data: await this.fetchPaginatedRecords(queryParams.pagination || null)
                    };
                case 'count':
                    return {
                        type: 'count',
                        count: await this.fetchRecordCountFromDb()
                    };
                default:
                    throw new Error(`Unsupported query type: ${queryType}`);
            }
        } finally {
            console.timeEnd('redis/resources/index/IndexProvidersActiveResource.fetchFromSource');
        }
    }


    protected async fetchAllRecords(): Promise<IndexProvidersActiveResponse[]> {
        console.time('redis/resources/index/IndexProvidersActiveResource.fetchAllRecords');
        try {
            let activeProviders = await this.getActiveProviderAddresses();

            if (activeProviders.length === 0) {
                logger.warn("No active providers found");
                return [];
            }

            const res = await queryJsinfo(
                async (db: PostgresJsDatabase) => db.select({
                    provider: JsinfoSchema.providerStakes.provider,
                    totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                    totalStake: sql<bigint>`COALESCE(SUM( CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + (CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT) )), 0) AS totalStake`,
                    rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                })
                    .from(JsinfoSchema.providerStakes)
                    .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                    .groupBy(JsinfoSchema.providerStakes.provider)
                    .orderBy(sql`rewardSum DESC`),
                'IndexProvidersActiveResource_fetchAllRecords'
            );

            const providersDetails: IndexProvidersActiveResponse[] = await Promise.all(res.map(async provider => ({
                provider: provider.provider || "",
                moniker: await ProviderMonikerService.GetMonikerForProvider(provider.provider),
                monikerfull: await ProviderMonikerService.GetMonikerFullDescription(provider.provider),
                rewardSum: provider.rewardSum,
                totalServices: provider.totalServices || "",
                totalStake: provider.totalStake.toString(),
            })));

            return providersDetails;
        } finally {
            console.timeEnd('redis/resources/index/IndexProvidersActiveResource.fetchAllRecords');
        }
    }

    protected async fetchPaginatedRecords(pagination: Pagination | null): Promise<IndexProvidersActiveResponse[]> {
        console.time('redis/resources/index/IndexProvidersActiveResource.fetchPaginatedRecords');
        try {
            let activeProviders = await this.getActiveProviderAddresses();

            if (activeProviders.length === 0) {
                logger.warn("No active providers found");
                return [];
            }

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
            if (!finalPagination.sortKey) {
                finalPagination.sortKey = defaultSortKey;
            }

            // If sorting by rewards, fetch all records and let the handler do the sorting
            if (finalPagination.sortKey?.toLowerCase() === 'rewardsusd' ||
                finalPagination.sortKey?.toLowerCase() === 'rewardsulava') {
                const data = await queryJsinfo(
                    async (db: PostgresJsDatabase) => db
                        .select({
                            provider: JsinfoSchema.providerStakes.provider,
                            totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                            totalStake: sql<bigint>`COALESCE(SUM( CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT) ), 0) AS totalStake`,
                            rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                        })
                        .from(JsinfoSchema.providerStakes)
                        .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                        .groupBy(JsinfoSchema.providerStakes.provider),
                    `IndexProvidersActiveResource_fetchPaginatedRecords_rewards_sort`
                );

                return Promise.all(data.map(async item => ({
                    provider: item.provider || "",
                    moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider),
                    monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider),
                    rewardSum: item.rewardSum || 0,
                    totalServices: item.totalServices,
                    totalStake: item.totalStake.toString()
                })));
            }

            // Original sorting logic for other fields
            const keyToColumnMap = {
                provider: JsinfoSchema.providerStakes.provider,
                moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker})`,
                rewardSum: sql`rewardSum`,
                totalServices: sql`totalServices`,
                totalStake: sql`totalStake`
            };

            // Check if the sort key is in the map
            if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey.toLowerCase())) {
                logger.warn(`Invalid sort key: ${finalPagination.sortKey}, using default: ${defaultSortKey}`);
                finalPagination.sortKey = defaultSortKey;
            }

            const sortColumn = keyToColumnMap[finalPagination.sortKey];
            const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

            if (sortColumn === keyToColumnMap["moniker"]) {
                const data = await queryJsinfo(
                    async (db: PostgresJsDatabase) => db.select({
                        provider: JsinfoSchema.providerStakes.provider,
                        moniker: sql`MAX(${JsinfoSchema.providerSpecMoniker.moniker}) as moniker`,
                        totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                        totalStake: sql<bigint>`COALESCE(SUM( CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT) ), 0) AS totalStake`,
                        rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                    })
                        .from(JsinfoSchema.providerStakes)
                        .leftJoin(JsinfoSchema.providerSpecMoniker, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerSpecMoniker.provider))
                        .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                        .groupBy(JsinfoSchema.providerStakes.provider)
                        .orderBy(orderFunction(sortColumn))
                        .offset((finalPagination.page - 1) * finalPagination.count)
                        .limit(finalPagination.count),
                    `IndexProvidersActiveResource_fetchPaginatedRecords_moniker_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
                );


                return Promise.all(data.map(async item => ({
                    provider: item.provider || "",
                    moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider),
                    monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider),
                    rewardSum: item.rewardSum || 0,
                    totalServices: item.totalServices,
                    totalStake: item.totalStake.toString()
                })));
            }

            const data = await queryJsinfo(
                async (db: PostgresJsDatabase) => db
                    .select({
                        provider: JsinfoSchema.providerStakes.provider,
                        totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                        totalStake: sql<bigint>`COALESCE(SUM( CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT) ), 0) AS totalStake`,
                        rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                    })
                    .from(JsinfoSchema.providerStakes)
                    .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                    .groupBy(JsinfoSchema.providerStakes.provider)
                    .orderBy(orderFunction(sortColumn))
                    .offset((finalPagination.page - 1) * finalPagination.count)
                    .limit(finalPagination.count),
                `IndexProvidersActiveResource_fetchPaginatedRecords_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
            );

            return Promise.all(data.map(async item => ({
                provider: item.provider || "",
                moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider),
                monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider),
                rewardSum: item.rewardSum || 0,
                totalServices: item.totalServices,
                totalStake: item.totalStake.toString()
            })));
        } catch (error) {
            logger.error('Error in fetchPaginatedRecords:', error);
            throw error;
        } finally {
            console.timeEnd('redis/resources/index/IndexProvidersActiveResource.fetchPaginatedRecords');
        }
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        console.time('redis/resources/index/IndexProvidersActiveResource.fetchRecordCountFromDb');
        try {
            let activeProviders = await this.getActiveProviderAddresses();

            if (activeProviders.length === 0) {
                logger.warn("No active providers found");
                return 0;
            }

            const res = await queryJsinfo(
                async (db: PostgresJsDatabase) => db.select({
                    count: sql<number>`COUNT(DISTINCT ${JsinfoSchema.providerStakes.provider})`,
                })
                    .from(JsinfoSchema.providerStakes)
                    .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders)),
                `IndexProvidersActiveResource_fetchRecordCountFromDb_${JSONStringify(activeProviders)}`
            );

            return res[0].count || 0;
        } finally {
            console.timeEnd('redis/resources/index/IndexProvidersActiveResource.fetchRecordCountFromDb');
        }
    }

    public async ConvertRecordsToCsv(data: IndexProvidersActiveResponse[]): Promise<string> {
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

