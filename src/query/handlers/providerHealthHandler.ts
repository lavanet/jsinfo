
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckDbInstance, GetDbInstance } from '../dbUtils';
import * as schema from '../../schema';
import { eq, desc, asc, sql } from "drizzle-orm";
import { Pagination, parsePagination } from '../queryUtils';

export const ProviderHealthHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        timestamp: { type: 'string' },
                        spec: { type: 'string' },
                        interface: { type: 'string' },
                        status: { type: 'string' },
                        message: { type: 'string' },
                    }
                }
            }
        }
    }
}

const createQuery = (pagination: Pagination | null, addr: string) => {
    const query = GetDbInstance().select().from(schema.providerHealthHourly)
        .where(eq(schema.providerHealthHourly.provider, addr));

    const validSortKeys = ["timestamp", "spec", "interface", "status", "message"];
    let sortKey = pagination?.sortKey || "timestamp";
    const direction = pagination?.direction || 'descending';

    if (!validSortKeys.includes(sortKey)) {
        sortKey = "timestamp";
        console.error(`Invalid sortKey: ${sortKey}. SortKey must be one of ${validSortKeys.join(', ')}.`);
    }

    query.orderBy(direction === 'ascending' ? asc(schema.providerHealthHourly[sortKey]) : desc(schema.providerHealthHourly[sortKey]));

    return query;
}

async function getItemCount(addr: string): Promise<number> {
    const result = await GetDbInstance()
        .select({ count: sql`cast(count(${schema.providerHealthHourly.id}) as integer)` })
        .from(schema.providerHealthHourly)
        .where(eq(schema.providerHealthHourly.provider, addr));

    const count = Number(result[0].count);
    return count;
}

const modifyResponse = (res: any[]) => {
    const isNotNullAndNotZero = (value: number | null) => value !== null && value !== 0;

    return res.map(item => {
        let message = item.message || '';

        if (isNotNullAndNotZero(item.block) || isNotNullAndNotZero(item.latency)) {
            let latencyInMs = item.latency !== null ? Math.round(item.latency / 1000) : 0;
            let blockMessage = `block: ${item.block}`;

            if (item.blocksaway !== null) {
                blockMessage += item.blocksaway === 0
                    ? ' (latest block)'
                    : ` (${item.blocksaway} blocks away from latest)`;
            }

            message = `${blockMessage}, latency: ${latencyInMs} ms`;
        }

        const { provider, block, latency, interface: interfaceValue, ...rest } = item;

        return {
            ...rest,
            message,
            interface: interfaceValue === null ? "" : interfaceValue
        };
    });
}

export async function ProviderHealthItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const count = await getItemCount(addr);
    return { itemCount: count };
}

export async function ProviderHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    let pagination: Pagination | null = parsePagination(request)

    let query = createQuery(pagination, addr);

    let res = await query.offset(pagination ? (pagination.page - 1) * pagination.count : 0).limit(pagination ? pagination.count : 250);

    if (res.length === 0 && pagination) {
        pagination = null;
        query = createQuery(pagination, addr);
        res = await query.limit(250);
    }

    return modifyResponse(res);
}