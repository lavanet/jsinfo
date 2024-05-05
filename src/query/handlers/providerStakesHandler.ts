
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
import { CachedDiskPsqlQuery } from '../classes/CachedDiskPsqlQuery';

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


class ProviderStakesData extends CachedDiskPsqlQuery<JsinfoSchema.ProviderStake> {
    private addr: string;

    constructor(addr: string) {
        super();
        this.addr = addr;
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderStakesData_${this.addr}`);
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

    public async getPaginatedItemsImpl(data: JsinfoSchema.ProviderStake[], pagination: Pagination | null): Promise<JsinfoSchema.ProviderStake[] | null> {

        const defaultSortKey = "specId"

        pagination = pagination || ParsePaginationFromString(defaultSortKey + ",descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = defaultSortKey;

        // Validate sortKey
        const validKeys = ["specId", "status", "geolocation", "addons", "extensions", "stake"];
        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = a[pagination.sortKey || defaultSortKey];
            const bValue = b[pagination.sortKey || defaultSortKey];
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
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
        return;
    }
    const providerStakesData = new ProviderStakesData(addr);
    try {
        const data = await providerStakesData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderStakesItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    const providerStakesData = new ProviderStakesData(addr);
    return providerStakesData.getTotalItemCount();
}

export async function ProviderStakesCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const providerHealthData = new ProviderStakesData(addr);
    const csv = await providerHealthData.getCSV();

    if (csv === null) {
        return;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderStakes_${addr}.csv`);
    reply.send(csv);
}