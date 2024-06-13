
// src/query/handlers/specStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { sql, desc, gt, and, eq } from "drizzle-orm";
import { FormatDates } from '../utils/queryDateUtils';
import { ReplaceArchive } from '../../indexer/indexerUtils';
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetAndValidateSpecIdFromRequest, GetNestedValue, SafeSlice } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export type SpecSpecsResponse = {
    stake: number | null;
    appliedHeight: number | null;
    geolocation: number | null;
    addonsAndExtensions: string;
    status: number | null;
    provider: string | null;
    moniker: string | null;
    blockId: number | null;
    cuSum90Days: number;
    cuSum30Days: number;
    relaySum90Days: number;
    relaySum30Days: number;
};

export const SpecStakesCachedHandlerOpts: RouteShorthandOptions = {
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
                                    type: ['number', 'null']
                                },
                                appliedHeight: {
                                    type: ['number', 'null']
                                },
                                geolocation: {
                                    type: ['number', 'null']
                                },
                                addonsAndExtensions: {
                                    type: 'string'
                                },
                                status: {
                                    type: ['number', 'null']
                                },
                                provider: {
                                    type: ['string', 'null']
                                },
                                moniker: {
                                    type: ['string', 'null']
                                },
                                blockId: {
                                    type: ['number', 'null']
                                },
                                cuSum30Days: {
                                    type: 'number'
                                },
                                relaySum30Days: {
                                    type: 'number'
                                },
                                cuSum90Days: {
                                    type: 'number'
                                },
                                relaySum90Days: {
                                    type: 'number'
                                },
                            }
                        }
                    }
                }
            }
        }
    }
};

class SpecStakesData extends CachedDiskDbDataFetcher<SpecSpecsResponse> {
    private spec: string;

    constructor(spec: string) {
        super("SpecStakesData");
        this.spec = spec;
    }

    public static GetInstance(spec: string): SpecStakesData {
        return SpecStakesData.GetInstanceBase(spec);
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `SpecStakesData_${this.spec}`);
    }

    protected getCSVFileNameImpl(): string {
        return `SpecStakes_${this.spec}.csv`;
    }

    // don't enable column has no id:
    // protected isSinceDBFetchEnabled(): boolean {

    protected async fetchDataFromDb(): Promise<SpecSpecsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        // Query for 90 days
        let stakesRes90Days = await QueryGetJsinfoReadDbInstance().select({
            stake: JsinfoSchema.providerStakes.stake,
            appliedHeight: JsinfoSchema.providerStakes.appliedHeight,
            geolocation: JsinfoSchema.providerStakes.geolocation,
            addonsAndExtensions: sql<string>`TRIM(TRAILING ', ' FROM CASE 
            WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' AND COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN '-' 
            WHEN COALESCE(${JsinfoSchema.providerStakes.addons}, '') = '' THEN 'extensions: ' || ${JsinfoSchema.providerStakes.extensions}
            WHEN COALESCE(${JsinfoSchema.providerStakes.extensions}, '') = '' THEN 'addons: ' || ${JsinfoSchema.providerStakes.addons}
            ELSE 'addons: ' || ${JsinfoSchema.providerStakes.addons} || ', extensions: ' || ${JsinfoSchema.providerStakes.extensions} 
        END)`,
            status: JsinfoSchema.providerStakes.status,
            provider: JsinfoSchema.providerStakes.provider,
            moniker: JsinfoSchema.providers.moniker,
            blockId: JsinfoSchema.providerStakes.blockId,
            cuSum90Days: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.cuSum}, 0), 0))`,
            relaySum90Days: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.relaySum}, 0), 0))`,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
            .leftJoin(JsinfoSchema.aggHourlyrelayPayments, and(
                eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.aggHourlyrelayPayments.provider),
                and(
                    eq(JsinfoSchema.providerStakes.specId, JsinfoSchema.aggHourlyrelayPayments.specId),
                    gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '90 day'`)
                )
            ))
            .where(eq(JsinfoSchema.providerStakes.specId, this.spec))
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId, JsinfoSchema.providers.moniker)
            .orderBy(desc(JsinfoSchema.providerStakes.stake))
            .offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        // Query for 30 days
        let stakesRes30Days = await QueryGetJsinfoReadDbInstance().select({
            provider: JsinfoSchema.providerStakes.provider,
            cuSum30Days: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.cuSum}, 0), 0))`,
            relaySum30Days: sql<number>`sum(COALESCE(NULLIF(${JsinfoSchema.aggHourlyrelayPayments.relaySum}, 0), 0))`,
        }).from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
            .leftJoin(JsinfoSchema.aggHourlyrelayPayments, and(
                eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.aggHourlyrelayPayments.provider),
                and(
                    eq(JsinfoSchema.providerStakes.specId, JsinfoSchema.aggHourlyrelayPayments.specId),
                    gt(sql<string>`DATE_TRUNC('day', ${JsinfoSchema.aggHourlyrelayPayments.datehour})`, sql<Date>`now() - interval '30 day'`)
                )
            ))
            .where(eq(JsinfoSchema.providerStakes.specId, this.spec))
            .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId, JsinfoSchema.providers.moniker)
            .orderBy(desc(JsinfoSchema.providerStakes.stake))
            .offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        let stakesRes30DaysMap = new Map(stakesRes30Days.map(item => [item.provider, item]));

        let combinedStakesRes: SpecSpecsResponse[] = stakesRes90Days.map((item90Days) => {
            let item30Days = stakesRes30DaysMap.get(item90Days.provider);
            return {
                ...item90Days,
                cuSum30Days: item30Days ? item30Days.cuSum30Days : 0,
                relaySum30Days: item30Days ? item30Days.relaySum30Days : 0,
                addonsAndExtensions: ReplaceArchive(item90Days.addonsAndExtensions),
            };
        }).sort((a, b) => b.cuSum90Days - a.cuSum90Days);

        return combinedStakesRes;
    }

    public async getPaginatedItemsImpl(
        data: SpecSpecsResponse[],
        pagination: Pagination | null
    ): Promise<SpecSpecsResponse[] | null> {
        const defaultSortKey = "cuSum";

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
        const validKeys = ["stake", "appliedHeight", "geolocation", "addonsAndExtensions", "status", "provider", "moniker", "blockId", "cuSum30Days", "cuSum90Days", "relaySum30Days", "relaySum90Days"];
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const sortKey = finalPagination.sortKey as string;
            const aValue = GetNestedValue(a, sortKey);
            const bValue = GetNestedValue(b, sortKey);
            return CompareValues(aValue, bValue, finalPagination.direction);
        });

        // Apply pagination
        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
    }

    public async getCSVImpl(data: SpecSpecsResponse[]): Promise<string> {
        const columns = [
            { key: "stake", name: "Stake" },
            { key: "appliedHeight", name: "Height" },
            { key: "geolocation", name: "Geolocation" },
            { key: "addonsAndExtensions", name: "Addons And Extensions" },
            { key: "status", name: "Status" },
            { key: "provider", name: "Provider" },
            { key: "moniker", name: "Moniker" },
            { key: "blockId", name: "Block ID" },
            { key: "cuSum30Days", name: "30-Day CU Sum" },
            { key: "cuSum90Days", name: "90-Day CU Sum" },
            { key: "relaySum30Days", name: "30-Day Relay Sum" },
            { key: "relaySum90Days", name: "90-Day Relay Sum " },
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

export async function SpecStakesCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }
    return await SpecStakesData.GetInstance(spec).getPaginatedItemsCachedHandler(request, reply)
}

export async function SpecStakesItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }
    return await SpecStakesData.GetInstance(spec).getTotalItemCountRawHandler(request, reply)
}

export async function SpecStakesCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return;
    }
    return await SpecStakesData.GetInstance(spec).getCSVRawHandler(request, reply)
}