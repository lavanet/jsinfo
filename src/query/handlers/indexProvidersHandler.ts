// src/query/handlers/indexProvidersHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '../../schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { sql, desc, not, eq, asc, and, isNull } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import { CSVEscape } from '../utils/queryUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

type IndexProvidersResponse = {
    addr: string,
    moniker: string,
    rewardSum: number,
    totalServices: string,
    totalStake: number,
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
        await QueryCheckJsinfoReadDbInstance();

        const res = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            moniker: JsinfoSchema.providers.moniker,
            totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
            totalStake: sql<number>`COALESCE(SUM(${JsinfoSchema.providerStakes.stake}), 0) as totalStake`,
            rewardSum: sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum}), 0) as rewardSum`,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggAllTimeRelayPayments,
                and(
                    eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider),
                    eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId)
                )
            )
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            )
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.moniker)
            .orderBy(sql`rewardSum DESC`)

        const providersDetails: IndexProvidersResponse[] = res.map(provider => ({
            addr: provider.provider || "",
            moniker: provider.moniker || "",
            rewardSum: provider.rewardSum,
            totalServices: provider.totalServices || "",
            totalStake: provider.totalStake,
        }));

        return providersDetails;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const res = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(DISTINCT ${JsinfoSchema.providerStakes.provider})`
            })
            .from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggAllTimeRelayPayments,
                and(
                    eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider),
                    eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId)
                )
            )
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
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
            addr: JsinfoSchema.providerStakes.provider,
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

        // Execute the query with proper sorting, pagination using offset and limit
        const queryBuilder = QueryGetJsinfoReadDbInstance()
            .select({
                provider: JsinfoSchema.providerStakes.provider,
                moniker: JsinfoSchema.providers.moniker,
                totalServices: sql<string>`CONCAT(SUM(CASE WHEN ${JsinfoSchema.providerStakes.status} = ${JsinfoSchema.LavaProviderStakeStatus.Active} THEN 1 ELSE 0 END), ' / ', COUNT(${JsinfoSchema.providerStakes.specId})) as totalServices`,
                totalStake: sql<number>`COALESCE(SUM(${JsinfoSchema.providerStakes.stake}), 0) as totalStake`,
                rewardSum: sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggAllTimeRelayPayments.rewardSum}), 0) as rewardSum`,
            })
            .from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggAllTimeRelayPayments,
                and(
                    eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.provider),
                    eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggAllTimeRelayPayments.specId)
                )
            )
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                )
            )
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.moniker)
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        // Hypothetical method to convert the query to a string
        // console.log(JSON.stringify(queryBuilder.toSQL()));
        let data = await queryBuilder;
        // console.log("res", data)

        return data.map(item => ({
            addr: item.provider || "",
            moniker: item.moniker || "",
            rewardSum: item.rewardSum || 0,
            totalServices: item.totalServices,
            totalStake: item.totalStake
        }));
    }

    protected async convertRecordsToCsv(data: IndexProvidersResponse[]): Promise<string> {
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

export async function IndexProvidersPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().PaginatedRecordsRequestHandler(request, reply)
}

export async function IndexProvidersItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().getTotalItemCountPaginatedHandler(request, reply)
}

export async function IndexProvidersCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await IndexProvidersData.GetInstance().CSVRequestHandler(request, reply)
}