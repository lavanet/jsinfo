
// src/query/handlers/providerStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { desc, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { ReplaceArchive } from '../../indexer/indexerUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export const ProviderStakesHandlerOpts: RouteShorthandOptions = {
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

class ProviderStakesData extends CachedDiskDbDataFetcher<JsinfoSchema.ProviderStake> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderStakesData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderStakesData {
        return ProviderStakesData.GetInstanceBase(addr);
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderStakesData_${this.addr}`);
    }

    protected getCSVFileName(): string {
        return `ProviderStakes_${this.addr}.csv`;
    }

    protected async fetchDataFromDb(): Promise<JsinfoSchema.ProviderStake[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let stakesRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerStakes).
            where(eq(JsinfoSchema.providerStakes.provider, this.addr)).orderBy(desc(JsinfoSchema.providerStakes.stake))

        stakesRes = stakesRes.map(item => {
            item.extensions = item.extensions ? ReplaceArchive(item.extensions || '') : "-";
            item.addons = item.addons ? item.addons : "-";
            return item;
        });

        return stakesRes;
    }

    public async getPaginatedItemsImpl(
        data: JsinfoSchema.ProviderStake[],
        pagination: Pagination | null
    ): Promise<JsinfoSchema.ProviderStake[] | null> {
        const defaultSortKey = "specId";
        const defaultPagination = ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        const finalPagination: Pagination = pagination ?? defaultPagination;

        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        const validKeys = ["specId", "status", "geolocation", "addons", "extensions", "stake"];
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        data.sort((a, b) => {
            const sortKey = finalPagination.sortKey as string;
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, finalPagination.direction);
        });

        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        const paginatedData = data.slice(start, end);

        return paginatedData;
    }

    public async getCSVImpl(data: JsinfoSchema.ProviderStake[]): Promise<string> {
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
    return await ProviderStakesData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderStakesItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderStakesData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderStakesCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderStakesData.GetInstance(addr).getCSVRawHandler(request, reply)
}