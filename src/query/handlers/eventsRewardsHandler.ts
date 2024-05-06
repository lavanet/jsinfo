// src/query/handlers/eventsRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { asc, desc, eq, gte } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues } from '../utils/queryUtils';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export interface EventsRewardsResponse {
    id: number | null;
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
    moniker: string | null;
    specId: string | null;
    blockId: number | null;
    consumer: string | null;
    tx: string | null;
}

export const EventsRewardsHandlerOpts: RouteShorthandOptions = {
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
                                id: { type: ['number', 'null'] },
                                relays: { type: ['number', 'null'] },
                                cu: { type: ['number', 'null'] },
                                pay: { type: ['number', 'null'] },
                                datetime: { type: ['string', 'null'] },
                                qosSync: { type: ['number', 'null'] },
                                qosAvailability: { type: ['number', 'null'] },
                                qosLatency: { type: ['number', 'null'] },
                                qosSyncExc: { type: ['number', 'null'] },
                                qosAvailabilityExc: { type: ['number', 'null'] },
                                qosLatencyExc: { type: ['number', 'null'] },
                                provider: { type: ['string', 'null'] },
                                moniker: { type: ['string', 'null'] },
                                specId: { type: ['string', 'null'] },
                                blockId: { type: ['number', 'null'] },
                                consumer: { type: ['string', 'null'] },
                                tx: { type: ['string', 'null'] },
                            }
                        }
                    }
                }
            }
        }
    }
};


class EventsRewardsData extends CachedDiskDbDataFetcher<EventsRewardsResponse> {

    constructor() {
        super("EventsRewardsData");
    }

    public static GetInstance(): EventsRewardsData {
        return EventsRewardsData.GetInstanceBase();
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, 'EventsRewardsHandlerData');
    }

    protected getCSVFileName(): string {
        return `EventsRewards.csv`;
    }

    protected async fetchDataFromDb(): Promise<EventsRewardsResponse[]> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const blockHeightQuery = await QueryGetJsinfoReadDbInstance()
                .select()
                .from(JsinfoSchema.blocks)
                .where(gte(JsinfoSchema.blocks.datetime, thirtyDaysAgo))
                .orderBy(asc(JsinfoSchema.blocks.datetime))
                .limit(1);

            const minBlockHeight = blockHeightQuery[0].height || 0;

            const paymentsRes = await QueryGetJsinfoReadDbInstance()
                .select()
                .from(JsinfoSchema.relayPayments)
                .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.relayPayments.provider, JsinfoSchema.providers.address))
                .where(gte(JsinfoSchema.relayPayments.blockId, minBlockHeight))
                .orderBy(desc(JsinfoSchema.relayPayments.id))
                .offset(0)
                .limit(5000);

            const flattenedRes = paymentsRes.map(data => ({
                ...data.relay_payments,
                moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
            }));

            return flattenedRes;
        } catch (error) {
            console.error(`EventsRewardsData error fetching data from DB: ${error}`);
            throw error;
        }
    }

    public async getPaginatedItemsImpl(data: EventsRewardsResponse[], pagination: Pagination | null): Promise<EventsRewardsResponse[] | null> {
        const defaultSortKey = "id"
        pagination = pagination || ParsePaginationFromString(defaultSortKey + ",descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE)
        if (pagination.sortKey === null) pagination.sortKey = defaultSortKey;

        const validKeys = [
            "id",
            "relays",
            "cu",
            "pay",
            "datetime",
            "qosSync",
            "qosAvailability",
            "qosLatency",
            "qosSyncExc",
            "qosAvailabilityExc",
            "qosLatencyExc",
            "provider",
            "moniker",
            "specId",
            "blockId",
            "consumer",
            "tx"
        ];

        if (!validKeys.includes(pagination.sortKey)) {
            const trimmedSortKey = pagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            const aValue = a[pagination.sortKey || defaultSortKey];
            const bValue = b[pagination.sortKey || defaultSortKey];
            return CompareValues(aValue, bValue, pagination.direction);
        });

        data = data.slice((pagination.page - 1) * pagination.count, pagination.page * pagination.count);

        return data;
    }

    public async getCSVImpl(data: EventsRewardsResponse[]): Promise<string> {
        const columns = [
            { key: "relays", name: "Relays" },
            { key: "cu", name: "CU" },
            { key: "pay", name: "Pay" },
            { key: "datetime", name: "Datetime" },
            { key: "qosSync", name: "QoSSync" },
            { key: "qosAvailability", name: "QoSAvailability" },
            { key: "qosLatency", name: "QoSLatency" },
            { key: "qosSyncExc", name: "QoSSyncExc" },
            { key: "qosAvailabilityExc", name: "QoSAvailabilityExc" },
            { key: "qosLatencyExc", name: "QoSLatencyExc" },
            { key: "provider", name: "Provider" },
            { key: "moniker", name: "Moniker" },
            { key: "specId", name: "SpecId" },
            { key: "blockId", name: "BlockId" },
            { key: "consumer", name: "Consumer" },
            { key: "tx", name: "Tx" },
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

export async function EventsRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsRewardsData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function EventsRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsRewardsData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function EventsRewardsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()
    return await EventsRewardsData.GetInstance().getCSVRawHandler(request, reply)
}