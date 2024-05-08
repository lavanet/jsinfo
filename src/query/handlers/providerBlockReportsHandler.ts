
// src/query/handlers/providerBlockReportsHandler.ts

// curl http://localhost:8081/providerBlockReports/lava@1tlkpa7t48fjl7qan4ete6xh0lsy679flnqdw57

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import fs from 'fs';
import path from 'path';
import { CompareValues, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export interface BlockReportsReponse {
    id: number;
    blockId: number;
    tx: string;
    timestamp: string;
    chainId: string;
    chainBlockHeight: number;
}

export const ProviderBlockReportsCachedHandlerOpts: RouteShorthandOptions = {
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
                                id: {
                                    type: 'number'
                                },
                                blockId: {
                                    type: 'number'
                                },
                                tx: {
                                    type: 'string'
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time'
                                },
                                chainId: {
                                    type: 'string'
                                },
                                chainBlockHeight: {
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

class ProviderBlockReportsData extends CachedDiskDbDataFetcher<BlockReportsReponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderBlockReportsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderBlockReportsData {
        return ProviderBlockReportsData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderBlockReports_${this.addr}.csv`;
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderBlockReportsData_${this.addr}`);
    }

    protected async fetchDataFromDb(): Promise<BlockReportsReponse[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerLatestBlockReports).
            where(
                and(
                    eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr),
                    gte(JsinfoSchema.providerLatestBlockReports.timestamp, thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.providerLatestBlockReports.timestamp)).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return result.map((row: JsinfoSchema.ProviderLatestBlockReports) => ({
            id: row.id,
            blockId: row.blockId ?? 0,
            tx: row.tx ?? '',
            timestamp: row.timestamp?.toISOString() ?? '',
            chainId: row.chainId,
            chainBlockHeight: row.chainBlockHeight ?? 0,
        }));
    }

    public async getPaginatedItemsImpl(data: BlockReportsReponse[], pagination: Pagination | null): Promise<BlockReportsReponse[] | null> {
        if (pagination == null) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        data = this.sortData(data, pagination.sortKey || "", pagination.direction);

        const start = (pagination.page - 1) * pagination.count;
        const end = start + pagination.count;

        // If slice would fail, return a [0,20] slice
        if (start < 0 || end < 0 || start > data.length || end > data.length) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        return data.slice(start, end);
    }

    private sortData(data: BlockReportsReponse[], sortKey: string, direction: 'ascending' | 'descending'): BlockReportsReponse[] {
        if (sortKey === "-" || sortKey === "") sortKey = "timestamp";

        if (sortKey && ["timestamp", "chain_id", "amount"].includes(sortKey)) {
            if (sortKey !== "timestamp" || direction !== "descending") {
                // default
            }
        } else {
            console.log(`Invalid sortKey: ${sortKey}`);
        }

        return data.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, direction);
        });
    }

    public async getCSVImpl(data: BlockReportsReponse[]): Promise<string> {
        let csv = 'time,blockId,tx,chainId,chainBlockHeight\n';
        data.forEach((item: BlockReportsReponse) => {
            csv += `${item.timestamp},${item.blockId},${item.chainId},${item.chainBlockHeight}\n`;
        });
        return csv;
    }
}

export async function ProviderBlockReportsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderBlockReportsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderBlockReportsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderBlockReportsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderBlockReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderBlockReportsData.GetInstance(addr).getCSVRawHandler(request, reply)
}