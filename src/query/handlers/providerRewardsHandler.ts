
// src/query/handlers/providerRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, gte, sql, and } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import { CSVEscape, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

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

export const ProviderRewardsPaginatedHandlerOpts: RouteShorthandOptions = {
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


class ProviderRewardsData extends RequestHandlerBase<ProviderRewardsResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderRewardsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderRewardsData {
        return ProviderRewardsData.GetInstanceBase(addr);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderRewards_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ProviderRewardsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        console.log("dasd", this.addr);

        const paymentsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.relayPayments).
            leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height)).
            where(
                and(
                    eq(JsinfoSchema.relayPayments.provider, this.addr), // this line is slow
                    gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                )).
            orderBy(desc(JsinfoSchema.relayPayments.id)).
            offset(0).
            limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        console.log("dasd12121", paymentsRes);

        return paymentsRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(*)`
            })
            .from(JsinfoSchema.relayPayments)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height))
            .where(eq(JsinfoSchema.relayPayments.provider, this.addr))
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return countResult[0].count;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ProviderRewardsResponse[]> {
        const defaultSortKey = "relay_payments.id";
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
            "relay_payments.id": JsinfoSchema.relayPayments.id,
            "relay_payments.specId": JsinfoSchema.relayPayments.specId,
            "relay_payments.blockId": JsinfoSchema.relayPayments.blockId,
            "blocks.datetime": JsinfoSchema.blocks.datetime,
            "relay_payments.consumer": JsinfoSchema.relayPayments.consumer,
            "relay_payments.relays": JsinfoSchema.relayPayments.relays,
            "relay_payments.cu": JsinfoSchema.relayPayments.cu,
            "relay_payments.qosSync": JsinfoSchema.relayPayments.qosSync,
            "relay_payments.qosSyncExc": JsinfoSchema.relayPayments.qosSyncExc
        };

        if (!Object.keys(keyToColumnMap).includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        await QueryCheckJsinfoReadDbInstance();

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        console.log("sortColu111mn: ", sortColumn);
        const paymentsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.relayPayments)
            .leftJoin(JsinfoSchema.blocks, eq(JsinfoSchema.relayPayments.blockId, JsinfoSchema.blocks.height))
            .orderBy(orderFunction(sortColumn))
            .offset((finalPagination.page - 1) * finalPagination.count)
            .limit(finalPagination.count);
        console.log("sortCo222lumn: ", sortColumn);

        return paymentsRes;
    }

    protected async convertRecordsToCsv(data: ProviderRewardsResponse[]): Promise<string> {
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

export async function ProviderRewardsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderRewardsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderRewardsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).getTotalItemCountPaginatiedHandler(request, reply)
}

export async function ProviderRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).CSVRequestHandler(request, reply)
}