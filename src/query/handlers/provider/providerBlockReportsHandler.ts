// src/query/handlers/provider/providerBlockReportsHandler.ts

// curl http://localhost:8081/providerBlockReports/lava@1tlkpa7t48fjl7qan4ete6xh0lsy679flnqdw57

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { queryJsinfo } from '@jsinfo/utils/db';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, sql } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../../queryConsts';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';

export interface BlockReportsResponse {
    id: number;
    blockId: number;
    tx: string;
    timestamp: string;
    chainId: string;
    chainBlockHeight: number;
}

export const ProviderBlockReportsPaginatedHandlerOpts: RouteShorthandOptions = {
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

class ProviderBlockReportsData extends RequestHandlerBase<BlockReportsResponse> {
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

    protected async fetchAllRecords(): Promise<BlockReportsResponse[]> {
        const result = await queryJsinfo(
            async (db) => await db.select()
                .from(JsinfoSchema.providerLatestBlockReports)
                .where(eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr))
                .orderBy(desc(JsinfoSchema.providerLatestBlockReports.id))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            'ProviderBlockReportsData_fetchAllRecords'
        );

        return result.map((row: JsinfoSchema.ProviderLatestBlockReports) => ({
            id: row.id,
            blockId: row.blockId ?? 0,
            tx: row.tx ?? '',
            timestamp: row.timestamp?.toISOString() ?? '',
            chainId: row.chainId,
            chainBlockHeight: row.chainBlockHeight ?? 0,
        }));
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        const countResult = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)::int`
            })
                .from(JsinfoSchema.providerLatestBlockReports)
                .where(eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr)),
            'ProviderBlockReportsData_fetchRecordCountFromDb'
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<BlockReportsResponse[]> {
        const defaultSortKey = "id";
        let finalPagination: Pagination;

        if (pagination) {
            finalPagination = pagination;
        } else {
            finalPagination = ParsePaginationFromString(
                `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
            );
        }

        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        const keyToColumnMap = {
            id: JsinfoSchema.providerLatestBlockReports.id,
            blockId: JsinfoSchema.providerLatestBlockReports.blockId,
            tx: JsinfoSchema.providerLatestBlockReports.tx,
            timestamp: JsinfoSchema.providerLatestBlockReports.timestamp,
            chainId: JsinfoSchema.providerLatestBlockReports.chainId,
            chainBlockHeight: JsinfoSchema.providerLatestBlockReports.chainBlockHeight
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        return await queryJsinfo(
            async (db) => await db.select()
                .from(JsinfoSchema.providerLatestBlockReports)
                .where(eq(JsinfoSchema.providerLatestBlockReports.provider, this.addr))
                .orderBy(finalPagination.direction === 'ascending' ? asc(keyToColumnMap[finalPagination.sortKey || defaultSortKey]) : desc(keyToColumnMap[finalPagination.sortKey || defaultSortKey]))
                .offset((finalPagination.page - 1) * finalPagination.count)
                .limit(finalPagination.count),
            `ProviderBlockReportsData_fetchPaginatedRecords_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}`
        ).then(reportsRes => reportsRes.map(row => ({
            id: row.id,
            blockId: row.blockId ?? 0,
            tx: row.tx ?? '',
            timestamp: row.timestamp ? row.timestamp.toISOString() : '',
            chainId: row.chainId,
            chainBlockHeight: row.chainBlockHeight ?? 0,
        })));
    }


    public async ConvertRecordsToCsv(data: BlockReportsResponse[]): Promise<string> {
        let csv = 'time,blockId,tx,chainId,chainBlockHeight\n';
        data.forEach((item: BlockReportsResponse) => {
            csv += `${item.timestamp},${item.blockId},${item.chainId},${item.chainBlockHeight}\n`;
        });
        return csv;
    }
}

export async function ProviderBlockReportsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerBlockReports", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderBlockReportsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderBlockReportsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerBlockReports", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderBlockReportsData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderBlockReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerBlockReports", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderBlockReportsData.GetInstance(addr).CSVRequestHandler(request, reply)
}