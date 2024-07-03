
// src/query/handlers/providerStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CSVEscape, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { ReplaceArchive } from '../../indexer/indexerUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

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
                                    type: 'number'
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

class ProviderStakesData extends RequestHandlerBase<JsinfoSchema.ProviderStake> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderStakesData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderStakesData {
        return ProviderStakesData.GetInstanceBase(addr);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderStakes_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<JsinfoSchema.ProviderStake[]> {
        await QueryCheckJsinfoReadDbInstance();

        let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).
            where(eq(JsinfoSchema.providerStakes.provider, this.addr)).orderBy(desc(JsinfoSchema.providerStakes.stake)).
            offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        stakesRes = stakesRes.map(item => {
            item.extensions = item.extensions ? ReplaceArchive(item.extensions || '') : "-";
            item.addons = item.addons ? item.addons : "-";
            return item;
        });

        return stakesRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`count(*)`
            })
            .from(JsinfoSchema.providerStakes)
            .where(eq(JsinfoSchema.providerStakes.provider, this.addr))
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return countResult[0].count;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<JsinfoSchema.ProviderStake[]> {
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
            stake: JsinfoSchema.providerStakes.stake
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        // Calculate offset for pagination
        const offset = (finalPagination.page - 1) * finalPagination.count;

        const stakesRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerStakes)
            .where(eq(JsinfoSchema.providerStakes.provider, this.addr))
            .orderBy(orderFunction(sortColumn))
            .offset(offset)
            .limit(finalPagination.count);

        const processedRes = stakesRes.map(item => {
            item.extensions = item.extensions ? ReplaceArchive(item.extensions || '') : "-";
            item.addons = item.addons ? item.addons : "-";
            return item;
        });

        return processedRes;
    }

    protected async convertRecordsToCsv(data: JsinfoSchema.ProviderStake[]): Promise<string> {
        const columns = [
            { key: "specId", name: "Spec" },
            { key: "status", name: "Status" },
            { key: "geolocation", name: "Geolocation" },
            { key: "addons", name: "Addons" },
            { key: "extensions", name: "Extensions" },
            { key: "stake", name: "Stake" },
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
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderStakesData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderStakesItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderStakesData.GetInstance(addr).getTotalItemCountPaginatiedHandler(request, reply)
}

export async function ProviderStakesCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderStakesData.GetInstance(addr).CSVRequestHandler(request, reply)
}