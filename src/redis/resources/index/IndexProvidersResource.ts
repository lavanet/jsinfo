// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, desc, not, eq, asc, and, isNull } from "drizzle-orm";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { Pagination, SerializePagination } from '@jsinfo/query/utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '@jsinfo/query/queryConsts';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';

const rewardSumSubQuery = sql`SELECT SUM(arp_sub.rewardSum) FROM(SELECT arp."provider", SUM(arp."rewardsum") AS rewardSum FROM ${JsinfoProviderAgrSchema.aggAllTimeRelayPayments} arp GROUP BY arp."provider") arp_sub WHERE arp_sub."provider" = ${JsinfoSchema.providerStakes.provider}`

interface IndexProvidersResponse {
    provider: string;
    moniker: string;
    monikerfull: string;
    rewardSum: number;
    totalServices: string;
    totalStake: string;
}

interface IndexProvidersResourceResponse {
    type: IndexProvidersQueryType;
    data?: IndexProvidersResponse[];
    count?: number;
}

type IndexProvidersQueryType = 'all' | 'count' | 'paginated';

interface IndexProvidersQueryParams {
    type: IndexProvidersQueryType;
    pagination?: Pagination | null;
}

export class IndexProvidersResource extends RedisResourceBase<IndexProvidersResourceResponse, IndexProvidersQueryParams> {
    protected readonly redisKey = 'index:providers';
    protected readonly ttlSeconds = 300;

    protected getRedisKey(params: IndexProvidersQueryParams): string {
        switch (params.type) {
            case 'all':
                return `${this.redisKey}:all`;
            case 'count':
                return `${this.redisKey}:count`;
            case 'paginated':
                return `${this.redisKey}:paginated:${params.pagination ? SerializePagination(params.pagination) : "default"}`;
            default:
                return this.redisKey;
        }
    }

    protected async fetchFromDb(db: PostgresJsDatabase, params: IndexProvidersQueryParams): Promise<IndexProvidersResourceResponse> {
        switch (params.type) {
            case 'all':
                return {
                    type: 'all',
                    data: await this.fetchAllRecords(db)
                };
            case 'paginated':
                return {
                    type: 'paginated',
                    data: await this.fetchPaginatedRecords(db, params.pagination || null)
                };
            case 'count':
                return {
                    type: 'count',
                    count: await this.fetchRecordCountFromDb(db)
                };
            default:
                throw new Error(`Unsupported query type: ${params.type}`);
        }
    }

    protected async fetchAllRecords(db: PostgresJsDatabase): Promise<IndexProvidersResponse[]> {
        const res = await db.select({
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

        const providersDetails: IndexProvidersResponse[] = await Promise.all(res.map(async provider => ({
            provider: provider.provider || "",
            moniker: await ProviderMonikerService.GetMonikerForProvider(provider.provider),
            monikerfull: await ProviderMonikerService.GetMonikerFullDescription(provider.provider),
            rewardSum: provider.rewardSum,
            totalServices: provider.totalServices || "",
            totalStake: provider.totalStake.toString(),
        })));

        return providersDetails;
    }

    protected async fetchRecordCountFromDb(db: PostgresJsDatabase): Promise<number> {
        const res = await db
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

    public async fetchPaginatedRecords(db: PostgresJsDatabase, pagination: Pagination | null): Promise<IndexProvidersResponse[]> {
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

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        if (sortColumn === keyToColumnMap["moniker"]) {
            // Execute the query with proper sorting, pagination using offset and limit
            const data = await db.select({
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

            return Promise.all(data.map(async item => ({
                provider: item.provider || "",
                moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider),
                monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider),
                rewardSum: item.rewardSum || 0,
                totalServices: item.totalServices,
                totalStake: item.totalStake.toString()
            })));
        }

        const data = await db.select({
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

        return Promise.all(data.map(async item => ({
            provider: item.provider || "",
            moniker: await ProviderMonikerService.GetMonikerForProvider(item.provider),
            monikerfull: await ProviderMonikerService.GetMonikerFullDescription(item.provider),
            rewardSum: item.rewardSum || 0,
            totalServices: item.totalServices,
            totalStake: item.totalStake.toString()
        })));
    }

    public async ConvertRecordsToCsv(data: IndexProvidersResponse[]): Promise<string> {
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
