// src/query/handlers/eventsRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance, QueryCheckJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { asc, desc, eq, gte, gt } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import path from 'path';
import { CSVEscape, CompareValues, GetDataLength, SafeSlice } from '../utils/queryUtils';
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

export const EventsRewardsCachedHandlerOpts: RouteShorthandOptions = {
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

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, 'EventsRewardsCachedHandlerData');
    }

    protected getCSVFileNameImpl(): string {
        return `EventsRewards.csv`;
    }

    protected isSinceDBFetchEnabled(): boolean {
        return true;
    }

    protected sinceUniqueField(): string {
        return "id";
    }

    protected async fetchDataFromDb(): Promise<EventsRewardsResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

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
                .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

            if (GetDataLength(paymentsRes) === 0) {
                this.setDataIsEmpty();
                return [];
            }

            const flattenedRes = paymentsRes.map(data => ({
                ...data.relay_payments,
                moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
            }));

            const highestId = flattenedRes[0]?.id;
            if (highestId !== undefined) {
                this.setSince(highestId);
            }

            return flattenedRes;
        } catch (error) {
            console.error(`EventsRewardsData error fetching data from DB: ${error}`);
            throw error;
        }
    }

    protected async fetchDataFromDbSinceFlow(since: number | string): Promise<EventsRewardsResponse[]> {
        await QueryCheckJsinfoReadDbInstance()

        const paymentsRes = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.relayPayments)
            .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.relayPayments.provider, JsinfoSchema.providers.address))
            .where(gt(JsinfoSchema.relayPayments.id, Number(since)))
            .orderBy(desc(JsinfoSchema.relayPayments.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        const flattenedRes = paymentsRes.map(data => ({
            ...data.relay_payments,
            moniker: data.providers?.moniker !== undefined ? data.providers?.moniker : null,
        }));

        const highestId = flattenedRes[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return flattenedRes;
    }

    public async getPaginatedItemsImpl(
        data: EventsRewardsResponse[],
        pagination: Pagination | null
    ): Promise<EventsRewardsResponse[] | null> {
        const defaultSortKey = "id";
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
        if (!validKeys.includes(finalPagination.sortKey)) {
            const trimmedSortKey = finalPagination.sortKey.substring(0, 500);
            throw new Error(`Invalid sort key: ${trimmedSortKey}`);
        }

        // Apply sorting
        data.sort((a, b) => {
            if (finalPagination.sortKey !== null) {
                const aValue = a[finalPagination.sortKey];
                const bValue = b[finalPagination.sortKey];
                return CompareValues(aValue, bValue, finalPagination.direction);
            }
            return 0;
        });

        // Apply pagination
        const start = (finalPagination.page - 1) * finalPagination.count;
        const end = finalPagination.page * finalPagination.count;
        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
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

export async function EventsRewardsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().getPaginatedItemsCachedHandler(request, reply)
}

export async function EventsRewardsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().getTotalItemCountRawHandler(request, reply)
}

export async function EventsRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    return await EventsRewardsData.GetInstance().getCSVRawHandler(request, reply)
}