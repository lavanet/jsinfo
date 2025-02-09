
// src/query/handlers/provider/providerRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { asc, desc, eq, gte, sql, and } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '@jsinfo/query/queryConsts';
import { CSVEscape } from '@jsinfo/utils/fmt';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { RequestHandlerBase } from '@jsinfo/query/classes/RequestHandlerBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export type ProviderRewardsResponse = {
    relay_payments: {
        id: number;
        relays: number | null;
        cu: number | null;
        pay: string | bigint | null;
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
                                            type: ['string', 'null']
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

    protected getCSVFileName(): string {
        return `ProviderRewards_${this.addr}.csv`;
    }

    private getThirtyDaysAgo(): Date {
        let thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return thirtyDaysAgo;
    }

    protected async fetchAllRecords(): Promise<ProviderRewardsResponse[]> {
        ;

        const thirtyDaysAgo = this.getThirtyDaysAgo();

        const paymentsRes: ProviderRewardsResponse[] = await queryJsinfo<ProviderRewardsResponse[]>(
            async (db) => await db.select({
                relay_payments: JsinfoSchema.relayPayments,
                blocks: {
                    height: JsinfoSchema.relayPayments.blockId,
                    datetime: JsinfoSchema.relayPayments.datetime
                }
            })
                .from(JsinfoSchema.relayPayments)
                .where(
                    and(
                        eq(JsinfoSchema.relayPayments.provider, this.addr),
                        gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                    )
                )
                .orderBy(desc(JsinfoSchema.relayPayments.id))
                .offset(0)
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION),
            `ProviderRewards_fetchAllRecords_${this.addr}`
        );

        paymentsRes.forEach((payment) => {
            payment.relay_payments.pay = payment.relay_payments.pay ? BigInt(payment.relay_payments.pay).toString() : null;
        });

        return paymentsRes;
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        ;

        const thirtyDaysAgo = this.getThirtyDaysAgo();

        const countResult = await queryJsinfo<{ count: number }[]>(
            async (db) => await db.select({
                count: sql<number>`COUNT(*)`
            })
                .from(JsinfoSchema.relayPayments)
                .where(
                    and(
                        eq(JsinfoSchema.relayPayments.provider, this.addr),
                        gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                    )
                ),
            `ProviderRewards_fetchRecordCount_${this.addr}`
        );

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
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
            "blocks.datetime": JsinfoSchema.relayPayments.datetime,
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

        ;

        const sortColumn = keyToColumnMap[finalPagination.sortKey];
        const orderFunction = finalPagination.direction === 'ascending' ? asc : desc;

        const thirtyDaysAgo = this.getThirtyDaysAgo();

        const paymentsRes: ProviderRewardsResponse[] = await queryJsinfo<ProviderRewardsResponse[]>(
            async (db) => await db.select({
                relay_payments: JsinfoSchema.relayPayments,
                blocks: {
                    height: JsinfoSchema.relayPayments.blockId,
                    datetime: JsinfoSchema.relayPayments.datetime
                }
            })
                .from(JsinfoSchema.relayPayments)
                .where(
                    and(
                        eq(JsinfoSchema.relayPayments.provider, this.addr),
                        gte(JsinfoSchema.relayPayments.datetime, thirtyDaysAgo)
                    )
                )
                .orderBy(orderFunction(sortColumn))
                .offset((finalPagination.page - 1) * finalPagination.count)
                .limit(finalPagination.count),
            `ProviderRewards_fetchPaginatedRecords_${finalPagination.sortKey}_${finalPagination.direction}_${finalPagination.page}_${finalPagination.count}_${thirtyDaysAgo}_${this.addr}`
        );

        paymentsRes.forEach((payment) => {
            payment.relay_payments.pay = payment.relay_payments.pay ? BigInt(payment.relay_payments.pay).toString() : null;
        });

        return paymentsRes;
    }

    public async ConvertRecordsToCsv(data: ProviderRewardsResponse[]): Promise<string> {
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
    let addr = await GetAndValidateProviderAddressFromRequest("providerRewards", request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderRewardsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderRewardsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerRewards", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerRewards", request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderRewardsData.GetInstance(addr).CSVRequestHandler(request, reply)
}