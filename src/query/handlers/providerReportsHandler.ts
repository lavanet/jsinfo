
// src/query/handlers/providerReportsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
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

export const ProviderReportsHandlerOpts: RouteShorthandOptions = {
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

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderReportsData_${this.addr}`);
    }

    protected getCSVFileName(): string {
        return `ProviderReports_${this.addr}.csv`;
    }

    protected async fetchDataFromDb(): Promise<ProviderReportsResponse[]> {
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
            orderBy(desc(JsinfoSchema.blocks['datetime'])).limit(5000);
        return reportsRes;
    }

    public async getPaginatedItemsImpl(data: ProviderReportsResponse[], pagination: Pagination | null): Promise<ProviderReportsResponse[] | null> {
        pagination = pagination || ParsePaginationFromString("blocks.datetime,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = "blocks.datetime";

        // Validate sortKey
        const validKeys = ["provider_reported.blockId", "blocks.datetime", "provider_reported.cu", "provider_reported.disconnections", "provider_reported.errors", "provider_reported.project"];
        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = GetNestedValue(a, pagination.sortKey || "blocks.datetime");
            const bValue = GetNestedValue(b, pagination.sortKey || "blocks.datetime");
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
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

export async function ProviderReportsHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderReportsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderReportsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderReportsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }
    return await ProviderReportsData.GetInstance(addr).getCSVRawHandler(request, reply)
}