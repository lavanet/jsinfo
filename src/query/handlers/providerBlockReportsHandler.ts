
// src/query/handlers/providerBlockReportsHandler.ts

// curl http://localhost:8081/providerBlockReports/lava@1tlkpa7t48fjl7qan4ete6xh0lsy679flnqdw57

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { and, desc, eq, gte, gt } from "drizzle-orm";
import { Pagination } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CompareValues, GetAndValidateProviderAddressFromRequest, SafeSlice } from '../utils/queryUtils';
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

    protected getCSVFileNameImpl(): string {
        return `ProviderBlockReports_${this.addr}.csv`;
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderBlockReportsData_${this.addr}`);
    }

    protected isSinceDBFetchEnabled(): boolean {
        return true;
    }

    protected sinceUniqueField(): string {
        return "id";
    }

    protected async fetchDataFromDb(): Promise<BlockReportsReponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerLatestBlockReports).
            where(
                and(
                    eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr),
                    gte(JsinfoSchema.providerLatestBlockReports.timestamp, thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.providerLatestBlockReports.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return result.map((row: JsinfoSchema.ProviderLatestBlockReports) => ({
            id: row.id,
            blockId: row.blockId ?? 0,
            tx: row.tx ?? '',
            timestamp: row.timestamp?.toISOString() ?? '',
            chainId: row.chainId,
            chainBlockHeight: row.chainBlockHeight ?? 0,
        }));
    }

    protected async fetchDataFromDbSinceFlow(since: number | string): Promise<BlockReportsReponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        let result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerLatestBlockReports).
            where(
                and(
                    eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr),
                    gt(JsinfoSchema.providerLatestBlockReports.id, Number(since))
                )
            ).
            orderBy(desc(JsinfoSchema.providerLatestBlockReports.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

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

        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
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