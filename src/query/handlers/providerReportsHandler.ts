
// src/query/handlers/providerReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetAndValidateProviderAddressFromRequest, GetNestedValue } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

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

export const ProviderReportsCachedHandlerOpts: RouteShorthandOptions = {
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

class ProviderReportsData extends CachedDiskDbDataFetcher<ProviderReportsResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderReportsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderReportsData {
        return ProviderReportsData.GetInstanceBase(addr);
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderReportsData_${this.addr}`);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderReports_${this.addr}.csv`;
    }

    protected async fetchDataFromDb(): Promise<ProviderReportsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let reportsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerReported).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.providerReported.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.providerReported.provider, this.addr),
                    gte(JsinfoSchema.blocks['datetime'], thirtyDaysAgo)
                )
            ).
            orderBy(desc(JsinfoSchema.providerReported.id)).offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);
        return reportsRes;
    }

    public async getPaginatedItemsImpl(
        data: ProviderReportsResponse[],
        pagination: Pagination | null
    ): Promise<ProviderReportsResponse[] | null> {
        const defaultSortKey = "blocks.datetime";

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
        const validKeys = ["provider_reported.blockId", "blocks.datetime", "provider_reported.cu", "provider_reported.disconnections", "provider_reported.errors", "provider_reported.project"];
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
        const paginatedData = data.slice(start, end);

        return paginatedData;
    }

    public async getCSVImpl(data: ProviderReportsResponse[]): Promise<string> {
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

export async function ProviderReportsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderReportsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderReportsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderReportsData.GetInstance(addr).getCSVRawHandler(request, reply)
}