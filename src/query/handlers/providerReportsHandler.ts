
// src/query/handlers/providerReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, gte, sql, and } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CSVEscape, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

export type ProviderReportsResponse = {
    provider_reported: {
        provider: string | null;
        blockId: number | null;
        cu: number | null;
        disconnections: number | null;
        epoch: number | null;
        errors: number | null;
        project: string | null;
        datetime: Date | null;
        totalComplaintEpoch: number | null;
        tx: string | null;
    };
    blocks: {
        height: number | null;
        datetime: Date | null;
    } | null;
};

export const ProviderReportsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                provider_reported: {
                                    type: 'object',
                                    properties: {
                                        provider: {
                                            type: ['string', 'null']
                                        },
                                        blockId: {
                                            type: ['number', 'null']
                                        },
                                        cu: {
                                            type: ['number', 'null']
                                        },
                                        disconnections: {
                                            type: ['number', 'null']
                                        },
                                        epoch: {
                                            type: ['number', 'null']
                                        },
                                        errors: {
                                            type: ['number', 'null']
                                        },
                                        project: {
                                            type: ['string', 'null']
                                        },
                                        datetime: {
                                            type: ['string', 'null'],
                                            format: 'date-time'
                                        },
                                        totalComplaintEpoch: {
                                            type: ['number', 'null']
                                        },
                                        tx: {
                                            type: ['string', 'null']
                                        }
                                    }
                                },
                                blocks: {
                                    type: ['object', 'null'],
                                    properties: {
                                        height: {
                                            type: ['number', 'null']
                                        },
                                        datetime: {
                                            type: ['string', 'null'],
                                            format: 'date-time'
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

class ProviderReportsData extends RequestHandlerBase<ProviderReportsResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderReportsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderReportsData {
        return ProviderReportsData.GetInstanceBase(addr);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderReports_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ProviderReportsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let reportsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerReported).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.providerReported.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.providerReported.provider, this.addr),
                    gte(JsinfoSchema.providerReported.datetime, thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.providerReported.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return reportsRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(*)`
            })
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.providerReported.blockId, JsinfoSchema.blocks.height))
            .where(eq(JsinfoSchema.providerReported.provider, this.addr))
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return countResult[0].count;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ProviderReportsResponse[]> {
        const defaultSortKey = "provider_reported.id";
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
            "provider_reported.id": JsinfoSchema.providerReported.id,
            "provider_reported.blockId": JsinfoSchema.providerReported.blockId,
            "blocks.datetime": JsinfoSchema.blocks.datetime,
            "provider_reported.cu": JsinfoSchema.providerReported.cu,
            "provider_reported.disconnections": JsinfoSchema.providerReported.disconnections,
            "provider_reported.errors": JsinfoSchema.providerReported.errors,
            "provider_reported.project": JsinfoSchema.providerReported.project
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const reportsRes = await QueryGetJsinfoReadDbInstance()
            .select({
                providerReported: {
                    id: JsinfoSchema.providerReported.id,
                    provider: JsinfoSchema.providerReported.provider,
                    blockId: JsinfoSchema.providerReported.blockId,
                    cu: JsinfoSchema.providerReported.cu,
                    disconnections: JsinfoSchema.providerReported.disconnections,
                    epoch: JsinfoSchema.providerReported.epoch,
                    errors: JsinfoSchema.providerReported.errors,
                    project: JsinfoSchema.providerReported.project,
                    datetime: JsinfoSchema.providerReported.datetime,
                    totalComplaintEpoch: JsinfoSchema.providerReported.totalComplaintEpoch,
                    tx: JsinfoSchema.providerReported.tx
                },
                blocks: {
                    height: JsinfoSchema.blocks.height,
                    datetime: JsinfoSchema.blocks.datetime
                }
            })
            .from(JsinfoSchema.providerReported)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.providerReported.blockId, JsinfoSchema.blocks.height))
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);

        return reportsRes.map(row => ({
            provider_reported: {
                provider: row.providerReported.provider,
                blockId: row.providerReported.blockId,
                cu: row.providerReported.cu,
                disconnections: row.providerReported.disconnections,
                epoch: row.providerReported.epoch,
                errors: row.providerReported.errors,
                project: row.providerReported.project,
                datetime: row.blocks?.datetime ?? null,
                totalComplaintEpoch: row.providerReported.totalComplaintEpoch,
                tx: row.providerReported.tx
            },
            blocks: row.blocks ? {
                height: row.blocks.height,
                datetime: row.blocks.datetime
            } : null
        }));
    }

    protected async convertRecordsToCsv(data: ProviderReportsResponse[]): Promise<string> {
        const columns = [
            { key: "provider_reported.blockId", name: "Block" },
            { key: "blocks.datetime", name: "Time" },
            { key: "provider_reported.cu", name: "CU" },
            { key: "provider_reported.disconnections", name: "Disconnections" },
            { key: "provider_reported.errors", name: "Errors" },
            { key: "provider_reported.project", name: "Project" },
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

export async function ProviderReportsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderReportsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).getTotalItemCountPaginatiedHandler(request, reply)
}

export async function ProviderReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderReportsData.GetInstance(addr).CSVRequestHandler(request, reply)
}