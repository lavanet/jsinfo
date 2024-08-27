// src/query/handlers/indexProvidersActiveHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, not, eq, asc, and, isNull, gt, inArray } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../../queryConsts';
import { CSVEscape } from '../../utils/queryUtils';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { MonikerCache } from '../../classes/MonikerCache';

/*
v1
SELECT "provider_stakes"."provider",
    CONCAT(SUM(CASE WHEN "provider_stakes"."status" = 1 THEN 1 ELSE 0 END), ' / ', COUNT("provider_stakes"."spec_id")) AS "totalServices",
    COALESCE(SUM(CAST("provider_stakes"."stake" AS BIGINT) + LEAST(CAST("provider_stakes"."delegate_total" AS BIGINT), CAST("provider_stakes"."delegate_limit" AS BIGINT))), 0) AS "totalStake",
    COALESCE(SUM("agg_alltime_relay_payments"."rewardsum"), 0) AS "rewardSum",
    COALESCE(SUM("agg_daily_relay_payments"."relaysum"), 0) AS "monthlyrelaysum"
FROM "provider_stakes"
LEFT JOIN "agg_alltime_relay_payments" ON ("provider_stakes"."provider" = "agg_alltime_relay_payments"."provider" AND "provider_stakes"."spec_id" = "agg_alltime_relay_payments"."spec_id")
LEFT JOIN "agg_daily_relay_payments" ON ("provider_stakes"."provider" = "agg_daily_relay_payments"."provider" AND "provider_stakes"."spec_id" = "agg_daily_relay_payments"."spec_id")
WHERE (NOT "provider_stakes"."status" = 2 AND NOT "provider_stakes"."provider" IS NULL AND NOT "provider_stakes"."provider" = '')
GROUP BY "provider_stakes"."provider"
HAVING SUM("agg_daily_relay_payments"."relaysum") >= 100 AND MAX("agg_daily_relay_payments"."dateday") > NOW() - INTERVAL '30 day'
ORDER BY "totalStake" DESC
LIMIT 20 OFFSET 80

v2
SELECT "provider_stakes"."provider",
    CONCAT(COUNT(DISTINCT CASE WHEN "provider_stakes"."status" = 1 THEN "provider_stakes"."spec_id" ELSE NULL END), ' / ', COUNT(DISTINCT "provider_stakes"."spec_id")) AS "totalServices",
    COALESCE(SUM(CAST("provider_stakes"."stake" AS BIGINT) + LEAST(CAST("provider_stakes"."delegate_total" AS BIGINT), CAST("provider_stakes"."delegate_limit" AS BIGINT))), 0) AS "totalStake",
    COALESCE(SUM("agg_alltime_relay_payments"."rewardsum"), 0) AS "rewardSum",
    COALESCE(SUM("agg_daily_relay_payments"."relaysum"), 0) AS "monthlyrelaysum"
FROM "provider_stakes"
LEFT JOIN "agg_alltime_relay_payments" ON ("provider_stakes"."provider" = "agg_alltime_relay_payments"."provider" AND "provider_stakes"."spec_id" = "agg_alltime_relay_payments"."spec_id")
LEFT JOIN "agg_daily_relay_payments" ON ("provider_stakes"."provider" = "agg_daily_relay_payments"."provider" AND "provider_stakes"."spec_id" = "agg_daily_relay_payments"."spec_id")
WHERE (NOT "provider_stakes"."status" = 2 AND NOT "provider_stakes"."provider" IS NULL AND NOT "provider_stakes"."provider" = '')
GROUP BY "provider_stakes"."provider"
HAVING SUM("agg_daily_relay_payments"."relaysum") >= 100 AND MAX("agg_daily_relay_payments"."dateday") > NOW() - INTERVAL '30 day'
ORDER BY "totalStake" DESC
LIMIT 20 OFFSET 80

v3
SELECT 
    ps."provider",
    CONCAT(COUNT(DISTINCT CASE WHEN ps."status" = 1 THEN ps."spec_id" ELSE NULL END), ' / ', COUNT(DISTINCT ps."spec_id")) AS "totalServices",
    COALESCE(SUM(CAST(ps."stake" AS BIGINT) + LEAST(CAST(ps."delegate_total" AS BIGINT), CAST(ps."delegate_limit" AS BIGINT))), 0) AS "totalStake",
    COALESCE((
        SELECT SUM(arp_sub.rewardSum)
        FROM (
            SELECT 
                arp."provider", 
                SUM(arp."rewardsum") AS rewardSum
            FROM "agg_alltime_relay_payments" arp
            GROUP BY arp."provider"
        ) arp_sub
        WHERE arp_sub."provider" = ps."provider"
    ), 0) AS "rewardSum"
FROM "provider_stakes" ps
WHERE (NOT ps."status" = 2 AND NOT ps."provider" IS NULL AND NOT ps."provider" = '')
GROUP BY ps."provider"
ORDER BY "totalStake" DESC
LIMIT 100
*/

const rewardSumSubQuery = sql`SELECT SUM(arp_sub.rewardSum) FROM(SELECT arp."provider", SUM(arp."rewardsum") AS rewardSum FROM ${JsinfoProviderAgrSchema.aggAllTimeRelayPayments} arp GROUP BY arp."provider") arp_sub WHERE arp_sub."provider" = ${JsinfoSchema.providerStakes.provider}`

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
        super("IndexProvidersActiveData");
    }

    public static GetInstance(): IndexProvidersActiveData {
        return IndexProvidersActiveData.GetInstanceBase();
    }

    protected getCSVFileName(): string {
        return `LavaTopProviders.csv`;
    }

    protected async getActiveProviderAddresses(): Promise<string[]> {
        const data = await QueryGetJsinfoReadDbInstance()
            .select({
                provider: JsinfoSchema.providerStakes.provider,
            })
            .from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments,
                and(
                    eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
                    eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId)
                )
            )
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                ))
            .groupBy(JsinfoSchema.providerStakes.provider)
            .having(
                and(
                    gt(sql<number>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql`NOW() - INTERVAL '30 day'`),
                    gt(sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}), 0)`, 100)
                )
            )

        return data.map(item => item.provider).filter((provider): provider is string => provider !== null);
    }

    protected async fetchAllRecords(): Promise<IndexProvidersActiveResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let activeProviders = await this.getActiveProviderAddresses();

        const res = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
            totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
            rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
        }).from(JsinfoSchema.providerStakes)
            .where(inArray(JsinfoSchema.providers.address, activeProviders))
            .orderBy(sql`rewardSum DESC`)

        const providersDetails: IndexProvidersActiveResponse[] = res.map(provider => ({
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
        await QueryCheckJsinfoReadDbInstance();

        let activeProviders = await this.getActiveProviderAddresses();

        const res = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(DISTINCT ${JsinfoSchema.providerStakes.provider})`,
            })
            .from(JsinfoSchema.providerStakes)
            .where(inArray(JsinfoSchema.providers.address, activeProviders))

        return res[0].count || 0;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<IndexProvidersActiveResponse[]> {
        let activeProviders = await this.getActiveProviderAddresses();

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
            moniker: JsinfoSchema.providers.moniker,
            rewardSum: sql`rewardSum`,
            totalServices: sql`totalServices`,
            totalStake: sql`totalStake`
        };

        // Check if the sort key is in the map, throw an error if not
        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;


        if (sortColumn === JsinfoSchema.providers.moniker) {
            // Execute the query with proper sorting, pagination using offset and limit
            const data = await QueryGetJsinfoReadDbInstance()
                .select({
                    provider: JsinfoSchema.providerStakes.provider,
                    moniker: JsinfoSchema.providers.moniker,
                    totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                    totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
                    rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
                })
                .from(JsinfoSchema.providerStakes)
                .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
                .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
                .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.moniker)
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

        const rewardSum = QueryGetJsinfoReadDbInstance().select({
            rewardSum: sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum}), 0) as rewardSum`,
        }).from(JsinfoProviderAgrSchema.aggAllTimeRelayPayments)

        const data = await QueryGetJsinfoReadDbInstance()
            .select({
                provider: JsinfoSchema.providerStakes.provider,
                totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                totalStake: sql<bigint>`COALESCE(SUM(CAST(${JsinfoSchema.providerStakes.stake} AS BIGINT) + LEAST(CAST(${JsinfoSchema.providerStakes.delegateTotal} AS BIGINT), CAST(${JsinfoSchema.providerStakes.delegateLimit} AS BIGINT))), 0) AS totalStake`,
                rewardSum: sql<number>`COALESCE((${rewardSumSubQuery}), 0) as rewardSum`,
            })
            .from(JsinfoSchema.providerStakes)
            .where(inArray(JsinfoSchema.providerStakes.provider, activeProviders))
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

