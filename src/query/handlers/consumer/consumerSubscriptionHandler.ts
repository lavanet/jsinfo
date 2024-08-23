// src/query/handlers/consumer/consumerSubscriptionHandler.ts

// curl http://localhost:8081/consumerSubscription/lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch | jq

/*
    {
      "consumer": "lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch",
      "plan": "whale",
      "duration_bought": "4",
      "duration_left": "3",
      "month_expiry": "1724842460",
      "month_cu_total": "9223372036854775808",
      "month_cu_left": "9223372036852699198",
      "cluster": "whale_6",
      "duration_total": "5",
      "auto_renewal_next_plan": "none",
      "future_subscription": "None",
      "credit": "768136688068500 ULAVA",
      "createdAt": "2024-08-07T11:13:55.000Z",
      "id": 9
    }
*/

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { desc, eq, gte, and } from "drizzle-orm";
import { RedisCache } from '../../classes/RedisCache';
import { JSONStringify, logger } from '../../../utils/utils';
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../../queryConsts';
import { RequestHandlerBase } from '../../classes/RequestHandlerBase';
import { Pagination } from '../../utils/queryPagination';
import { CSVEscape } from '../../utils/queryUtils';

type ConsumerSubscriptionRawEntry = {
    id: number;
    consumer: string;
    plan: string | null;
    createdAt: Date;
    fulltext: string | null;
};

type ConsumerSubscriptionEntry = {
    consumer: string;
    plan: string;
    duration_bought: string;
    duration_left: string;
    month_expiry: string;
    month_cu_total: string;
    month_cu_left: string;
    cluster: string;
    duration_total: string;
    auto_renewal_next_plan: string;
    future_subscription: string;
    credit: string;
    createdAt: string;
    id: number;
};

export const ConsumerSubscriptionRawHandlerOpts: RouteShorthandOptions = {
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
                                consumer: { type: 'string' },
                                plan: { type: 'string' },
                                duration_bought: { type: 'string' },
                                duration_left: { type: 'string' },
                                month_expiry: { type: 'string' },
                                month_cu_total: { type: 'string' },
                                month_cu_left: { type: 'string' },
                                cluster: { type: 'string' },
                                duration_total: { type: 'string' },
                                auto_renewal_next_plan: { type: 'string' },
                                future_subscription: { type: 'string' },
                                credit: { type: 'string' },
                                createdAt: { type: 'string' },
                                id: { type: 'integer' }
                            },
                        }
                    },
                },
            }
        }
    }
};

async function fetchAllData(addr: string): Promise<ConsumerSubscriptionRawEntry[]> {
    await QueryCheckJsinfoReadDbInstance();

    let nintyDaysAgo = new Date();
    nintyDaysAgo.setDate(nintyDaysAgo.getDate() - 90);

    let reportsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumerSubscriptionList)
        .where(
            and(
                eq(JsinfoSchema.consumerSubscriptionList.consumer, addr),
                gte(JsinfoSchema.consumerSubscriptionList.createdAt, nintyDaysAgo)
            )
        )
        .orderBy(desc(JsinfoSchema.consumerSubscriptionList.id))
        .offset(0)
        .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

    const uniqueEntries = new Map<string, ConsumerSubscriptionRawEntry>();

    reportsRes.forEach(entry => {
        const key = `${entry.consumer}-${entry.plan}-${entry.fulltext}`;
        const existingEntry = uniqueEntries.get(key);
        if (!existingEntry || existingEntry.createdAt < entry.createdAt) {
            uniqueEntries.set(key, entry);
        }
    });

    const uniqueReportsRes = Array.from(uniqueEntries.values());

    return uniqueReportsRes;
}

async function getAllDataNoRedis(addr: string): Promise<ConsumerSubscriptionEntry[]> {
    const data: ConsumerSubscriptionRawEntry[] = await fetchAllData(addr);
    const rets: any[] = [];

    data.forEach((item, idx) => {
        try {
            if (!item.fulltext) return;
            let ret = JSON.parse(item.fulltext);
            ret.createdAt = item.createdAt;
            ret.id = item.id;

            try {
                const credit = JSON.parse(ret.credit.replace(/'/g, '"'));
                ret.credit = credit.amount + " " + credit.denom.toUpperCase();
            } catch (creditError) {
                console.error(`Error parsing credit for item at index ${idx}:`, creditError);
            }

            rets.push(ret);
        } catch (error) {
            console.error(`Error processing item at index ${idx}:`, error);
            rets.push(item);
        }
    });

    return rets;
}

async function getAllData(addr: string): Promise<ConsumerSubscriptionEntry[]> {
    const val = await RedisCache.get("ConsumerSubscriptionRawHandler-" + addr);
    if (val) {
        try {
            const parsed = JSON.parse(val);
            if (!Array.isArray(parsed)) {
                throw new Error("Parsed value is not an array");
            }
            return parsed;
        } catch (e) {
            logger.error("Error parsing JSON from Redis cache", e);
        }
    }
    const data = await getAllDataNoRedis(addr);
    await RedisCache.set("ConsumerSubscriptionRawHandler-" + addr, JSONStringify(data), 10 * 60); // Ensure data is stringified before storing
    return data;
}

function sortList(list: ConsumerSubscriptionEntry[], key: string, direction: 'ascending' | 'descending'): ConsumerSubscriptionEntry[] {
    return list.sort((a, b) => {
        if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
        if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
        return 0;
    });
}
class ConsumerSubscriptionData extends RequestHandlerBase<ConsumerSubscriptionEntry> {

    private addr: string;

    constructor(addr: string) {
        super("ConsumerSubscriptionData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ConsumerSubscriptionData {
        return ConsumerSubscriptionData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ConsumerSubscription_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<ConsumerSubscriptionEntry[]> {
        return await getAllData(this.addr);
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        return (await getAllData(this.addr)).length;
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<ConsumerSubscriptionEntry[]> {
        const defaultSortKey = "id";
        const defaultPagination: Pagination = {
            sortKey: defaultSortKey,
            direction: 'descending',
            page: 1,
            count: JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE,
        };

        if (!pagination) {
            throw new Error("Pagination parameter is required");
        }
        if (typeof pagination.page !== 'number' || pagination.page < 1) {
            throw new Error("Page number must be a positive integer");
        }
        if (typeof pagination.count !== 'number' || pagination.count < 1) {
            throw new Error("Count must be a positive integer");
        }

        const finalPagination = { ...defaultPagination, ...pagination };
        finalPagination.sortKey = finalPagination.sortKey || defaultSortKey;

        if (typeof finalPagination.sortKey !== 'string') {
            throw new Error("Sort key must be a string");
        }

        const staticList = await getAllData(this.addr);

        const sortedList = sortList(staticList, finalPagination.sortKey, finalPagination.direction);
        const offset = (finalPagination.page - 1) * finalPagination.count;

        if (offset >= staticList.length) {
            throw new Error("Page number is out of range");
        }

        const paginatedList = sortedList.slice(offset, offset + finalPagination.count);

        return paginatedList;
    }

    protected async convertRecordsToCsv(data: ConsumerSubscriptionEntry[]): Promise<string> {
        const columns = [
            { key: "plan", name: "Plan" },
            { key: "duration_bought", name: "Duration Bought" },
            { key: "duration_left", name: "Duration Left" },
            { key: "month_expiry", name: "Month Expiry" },
            { key: "month_cu_total", name: "Month CU (left/total)" },
            { key: "cluster", name: "Cluster" },
            { key: "duration_total", name: "Duration Total" },
            { key: "auto_renewal_next_plan", name: "Auto Renewal Next Plan" },
            { key: "future_subscription", name: "Future Subscription" },
            { key: "credit", name: "Credit" },
            { key: "createdAt", name: "Creation Date" },
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

export async function ConsumerSubscriptionPaginatedRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ConsumerSubscriptionData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ConsumerSubscriptionItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ConsumerSubscriptionData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ConsumerSubscriptionCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ConsumerSubscriptionData.GetInstance(addr).CSVRequestHandler(request, reply)
}
