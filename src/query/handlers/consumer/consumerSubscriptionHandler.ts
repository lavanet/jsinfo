// src/query/handlers/consumer/consumerSubscriptionHandler.ts

// curl http://localhost:8081/consumerSubscription/lava@1ep8a2k9cpvkzehm7gshyaz900nn35syk9stlhf

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { desc, eq, gte, and } from "drizzle-orm";
import { RedisCache } from '../../classes/RedisCache';
import { JSONStringify, JSONStringifySpaced, logger } from '../../../utils/utils';
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';
import { GetAndValidateConsumerAddressFromRequest } from '../../utils/queryRequestArgParser';

type ReportEntry = {
    id: number;
    consumer: string;
    plan: string | null;
    createdAt: Date;
    fulltext: string | null;
};

export const ConsumerSubscriptionRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            consumer: { type: 'string' },
                            plan: { type: 'string' },
                            fulltext: { type: ['string', 'null'] }
                        }
                    },
                    id: { type: 'number' },
                    timestamp: { type: 'string' },
                    itemCount: { type: 'number' },
                    idx: { type: 'number' }
                },
                required: ['data', 'id', 'timestamp', 'itemCount', 'idx']
            }
        }
    }
};

async function fetchAllData(addr: string): Promise<ReportEntry[]> {
    await QueryCheckJsinfoReadDbInstance();

    let thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let reportsRes = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumerSubscriptionList)
        .where(
            and(
                eq(JsinfoSchema.consumerSubscriptionList.consumer, addr),
                gte(JsinfoSchema.consumerSubscriptionList.createdAt, thirtyDaysAgo)
            )
        )
        .orderBy(desc(JsinfoSchema.consumerSubscriptionList.id))
        .offset(0)
        .limit(500);

    return reportsRes
}

async function getAllData(addr: string): Promise<ReportEntry[]> {
    const val = await RedisCache.get("ConsumerSubscriptionRawHandler-" + addr);
    if (val) {
        try {
            return JSON.parse(val);
        } catch (e) {
            logger.error("Error parsing JSON from Redis cache", e);
        }
    }
    const data = await fetchAllData(addr);
    await RedisCache.set("ConsumerSubscriptionRawHandler-" + addr, JSONStringify(data), 10 * 60); // Ensure data is stringified before storing
    return data;
}

export async function ConsumerSubscriptionRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateConsumerAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }

    const data: ReportEntry[] = await getAllData(addr);

    const idx = parseInt((request.query as any).idx, 10);
    if (!isNaN(idx) && idx >= 0 && idx < data.length) {
        const item = data[idx];
        return {
            data: item,
            id: item.id,
            timestamp: item.createdAt.toISOString(),
            itemCount: data.length,
            idx: idx
        };
    }

    if (idx == 0 && data.length == 0) {
        return {
            data: "empty",
            id: "",
            timestamp: 0,
            itemCount: 0,
            idx: 0
        };
    }

    WriteErrorToFastifyReply(reply, "Invalid 'idx' query parameter. Please provide a valid index: " + JSONStringifySpaced(request.query));
    return reply;
}
