
// src/query/handlers/providerStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql, and } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '@jsinfo/query/utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { ReplaceArchive } from '@jsinfo/indexer/utils/indexerUtils';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { BigIntIsZero } from '@jsinfo/utils/bigint';
import { queryJsinfo } from '@jsinfo/utils/db';

type ProviderStakesResponse = {
    stake: string | null;
    delegateTotal: string | null;
    delegateCommission: string | null;
    totalStake: string | null;
    appliedHeight: number | null;
    geolocation: number | null;
    addons: string | null;
    extensions: string | null;
    status: number | null;
    provider: string | null;
    specId: string | null;
    blockId: number | null;
};

export const ProviderStakesPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                stake: {
                                    type: ['string', 'null']
                                },
                                delegateTotal: {
                                    type: ['string', 'null']
                                },
                                delegateCommission: {
                                    type: ['string', 'null']
                                },
                                totalStake: {
                                    type: ['string', 'null']
                                },
                                appliedHeight: {
                                    type: 'number'
                                },
                                geolocation: {
                                    type: 'number'
                                },
                                addons: {
                                    type: 'string'
                                },
                                extensions: {
                                    type: 'string'
                                },
                                status: {
                                    type: 'number'
                                },
                                provider: {
                                    type: 'string'
                                },
                                specId: {
                                    type: 'string'
                                },
                                blockId: {
                                    type: 'number'
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class ProviderStakesData extends RequestHandlerBase<ProviderStakesResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderStakesData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderStakesData {
        return ProviderStakesData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderStakes_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ProviderStakesResponse[]> {

        let stakesRes = await queryJsinfo(
            async (db) => await db.select({
                stake: JsinfoSchema.providerStakes.stake,
                delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
                delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
                appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
                geolocation: JsinfoSchema.providerStakes.geolocation,
                addons: JsinfoSchema.providerStakes.addons,
                extensions: JsinfoSchema.providerStakes.extensions,
                status: JsinfoSchema.providerStakes.status,
                provider: JsinfoSchema.providerStakes.provider,
                specId: JsinfoSchema.providerStakes.specId,
                blockId: JsinfoSchema.providerStakes.blockId,
                totalStake: sql<bigint>`(${JsinfoSchema.providerStakes.stake} + ${JsinfoSchema.providerStakes.delegateTotal}) as totalStake`,
            })
                .from(JsinfoSchema.providerStakes)
                .where(and(eq(JsinfoSchema.providerStakes.provider, this.addr),
                    eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active))
                ).orderBy(desc(JsinfoSchema.providerStakes.stake))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            `ProviderStakes_fetchAllRecords_${this.addr}`
        );

        const processedRes = stakesRes.map(item => ({
            ...item,
            stake: BigIntIsZero(item.stake) ? "0" : item.stake?.toString() ?? "0",
            delegateTotal: BigIntIsZero(item.delegateTotal) ? "0" : item.delegateTotal?.toString() ?? "0",
            delegateCommission: BigIntIsZero(item.delegateCommission) ? "0" : item.delegateCommission?.toString() ?? "0",
            totalStake: BigIntIsZero(item.totalStake) ? "0" : item.totalStake?.toString() ?? "0",
            extensions: item.extensions ? ReplaceArchive(item.extensions || '') : "-",
            addons: item.addons ? item.addons : "-"
        }));

        return processedRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        const countResult = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)`
            })
                .from(JsinfoSchema.providerStakes)
                .where(and(eq(JsinfoSchema.providerStakes.provider, this.addr),
                    eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active))),
            `ProviderStakes_fetchRecordCount_${this.addr}`
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ProviderStakesResponse[]> {
        const defaultSortKey = "specId";
        const defaultPagination = ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        const finalPagination: Pagination = pagination ?? defaultPagination;

        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        const keyToColumnMap = {
            specId: JsinfoSchema.providerStakes.specId,
            status: JsinfoSchema.providerStakes.status,
            geolocation: JsinfoSchema.providerStakes.geolocation,
            addons: JsinfoSchema.providerStakes.addons,
            extensions: JsinfoSchema.providerStakes.extensions,
            stake: JsinfoSchema.providerStakes.stake,
            delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
            delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
            totalStake: sql`totalStake`
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const offset = (finalPagination.page - 1) * finalPagination.count;

        const stakesRes = await queryJsinfo(
            async (db) => await db.select({
                stake: JsinfoSchema.providerStakes.stake,
                delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
                delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
                appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
                geolocation: JsinfoSchema.providerStakes.geolocation,
                addons: JsinfoSchema.providerStakes.addons,
                extensions: JsinfoSchema.providerStakes.extensions,
                status: JsinfoSchema.providerStakes.status,
                provider: JsinfoSchema.providerStakes.provider,
                specId: JsinfoSchema.providerStakes.specId,
                blockId: JsinfoSchema.providerStakes.blockId,
                totalStake: sql<bigint>`( COALESCE(${JsinfoSchema.providerStakes.stake}, 0) + COALESCE(${JsinfoSchema.providerStakes.delegateTotal}, 0) ) as totalStake`,
            })
                .from(JsinfoSchema.providerStakes)
                .where(and(
                    eq(JsinfoSchema.providerStakes.provider, this.addr),
                    eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active))
                )
                .orderBy(orderFunction(sortColumn))
                .offset(offset)
                .limit(finalPagination.count),
            `ProviderStakes_fetchPaginatedRecords_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}_${this.addr}`
        );

        const processedRes = stakesRes.map(item => ({
            ...item,
            stake: BigIntIsZero(item.stake) ? "0" : item.stake?.toString() ?? "0",
            delegateTotal: BigIntIsZero(item.delegateTotal) ? "0" : item.delegateTotal?.toString() ?? "0",
            delegateCommission: BigIntIsZero(item.delegateCommission) ? "0" : item.delegateCommission?.toString() ?? "0",
            totalStake: BigIntIsZero(item.totalStake) ? "0" : item.totalStake?.toString() ?? "0",
            extensions: item.extensions ? ReplaceArchive(item.extensions || '') : "-",
            addons: item.addons ? item.addons : "-"
        }));

        return processedRes;
    }

    public async ConvertRecordsToCsv(data: ProviderStakesResponse[]): Promise<string> {
        const columns = [
            { key: "specId", name: "Spec" },
            { key: "status", name: "Status" },
            { key: "geolocation", name: "Geolocation" },
            { key: "addons", name: "Addons" },
            { key: "extensions", name: "Extensions" },
            { key: "stake", name: "Self Stake" },
            { key: "totalStake", name: "Total Stake" },
            { key: "delegateTotal", name: "Delegate Total" },
            { key: "delegateCommission", name: "Delegate Commission" },
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

export async function ProviderStakesHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerStakes", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderStakesData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderStakesItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerStakes", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderStakesData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderStakesCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerStakes", request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderStakesData.GetInstance(addr).CSVRequestHandler(request, reply)
}