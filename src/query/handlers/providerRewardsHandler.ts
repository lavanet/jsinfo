
// src/query/handlers/providerRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { and, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetAndValidateProviderAddressFromRequest, GetNestedValue } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export type ProviderRewardsResponse = {
    relay_payments: {
        id: number;
        relays: number | null;
        cu: number | null;
        pay: number | null;
        datetime: Date | null;
        qosSync: number | null;
        qosAvailability: number | null;
        qosLatency: number | null;
        qosSyncExc: number | null;
        qosAvailabilityExc: number | null;
        qosLatencyExc: number | null;
        provider: string | null;
        specId: string | null;
        blockId: number | null;
        consumer: string | null;
        tx: string | null;
    };
    blocks: { datetime: Date | null; height: number | null } | null
};

export const ProviderRewardsHandlerOpts: RouteShorthandOptions = {
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
                                relay_payments: {
                                    type: 'object',
                                    properties: {
                                        id: {
                                            type: 'number'
                                        },
                                        relays: {
                                            type: ['number', 'null']
                                        },
                                        cu: {
                                            type: ['number', 'null']
                                        },
                                        pay: {
                                            type: ['number', 'null']
                                        },
                                        datetime: {
                                            type: ['string', 'null'],
                                            format: 'date-time'
                                        },
                                        qosSync: {
                                            type: ['number', 'null']
                                        },
                                        qosAvailability: {
                                            type: ['number', 'null']
                                        },
                                        qosLatency: {
                                            type: ['number', 'null']
                                        },
                                        qosSyncExc: {
                                            type: ['number', 'null']
                                        },
                                        qosAvailabilityExc: {
                                            type: ['number', 'null']
                                        },
                                        qosLatencyExc: {
                                            type: ['number', 'null']
                                        },
                                        provider: {
                                            type: ['string', 'null']
                                        },
                                        specId: {
                                            type: ['string', 'null']
                                        },
                                        blockId: {
                                            type: ['number', 'null']
                                        },
                                        consumer: {
                                            type: ['string', 'null']
                                        },
                                        tx: {
                                            type: ['string', 'null']
                                        }
                                    }
                                },
                                blocks: {
                                    type: 'object',
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


class ProviderRewardsData extends CachedDiskDbDataFetcher<ProviderRewardsResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderRewardsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderRewardsData {
        return ProviderRewardsData.GetInstanceBase(addr);
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderRewardsData_${this.addr}`);
    }

    protected getCSVFileName(): string {
        return `ProviderRewards_${this.addr}.csv`;
    }

    protected async fetchDataFromDb(): Promise<ProviderRewardsResponse[]> {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const paymentsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.relayPayments).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.relayPayments.provider, this.addr),
                    gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                )).
            orderBy(desc(JsinfoSchema.relayPayments.id)).offset(0).limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        return paymentsRes;
    }

    public async getPaginatedItemsImpl(
        data: ProviderRewardsResponse[],
        pagination: Pagination | null
    ): Promise<ProviderRewardsResponse[] | null> {
        const defaultSortKey = "relay_payments.id";
        const defaultPagination = ParsePaginationFromString(
            `${defaultSortKey},descending,1,${JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE}`
        );

        // Use the provided pagination or the default one
        const finalPagination: Pagination = pagination ?? defaultPagination;

        // If sortKey is null, set it to the defaultSortKey
        if (finalPagination.sortKey === null) {
            finalPagination.sortKey = defaultSortKey;
        }

        // Validate sortKey
        const validKeys = ["relay_payments.specId", "relay_payments.blockId", "blocks.datetime", "relay_payments.consumer", "relay_payments.relays", "relay_payments.cu", "relay_payments.qosSync", "relay_payments.qosSyncExc"];
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


    public async getCSVImpl(data: ProviderRewardsResponse[]): Promise<string> {
        const columns = [
            { key: "relay_payments.specId", name: "Spec" },
            { key: "relay_payments.blockId", name: "Block" },
            { key: "blocks.datetime", name: "Time" },
            { key: "relay_payments.consumer", name: "Consumer" },
            { key: "relay_payments.relays", name: "Relays" },
            { key: "relay_payments.cu", name: "CU" },
            { key: "relay_payments.qosSync", name: "QoS" },
            { key: "relay_payments.qosSyncExc", name: "Excellence" },
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

export async function ProviderRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderRewardsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderRewardsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).getCSVRawHandler(request, reply)
}