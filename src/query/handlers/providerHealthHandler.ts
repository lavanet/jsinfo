
// src/query/handlers/providerHealth.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckDbInstance, GetDbInstance } from '../dbUtils';
import * as schema from '../../schema';
import { eq, desc } from "drizzle-orm";

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

export async function ProviderHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance()

    const { addr } = request.params as { addr: string }
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return;
    }

    const res = await GetDbInstance().select().from(schema.providerHealthHourly)
        .where(eq(schema.providerHealthHourly.provider, addr)).orderBy(desc(schema.providerHealthHourly.timestamp))
        .orderBy(desc(schema.providerHealthHourly.spec)).offset(0).limit(250)

    if (res.length < 1) {
        reply.code(400).send({ error: 'Health data for provider does not exist' });
        return;
    }

    const isNotNullAndNotZero = (value: number | null) => value !== null && value !== 0;

    const modifiedRes = res.map(item => {
        let message = item.message || '';

        if (isNotNullAndNotZero(item.block) || isNotNullAndNotZero(item.latency)) {
            let latencyInMs = Math.round(item.latency / 1000);
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

    return modifiedRes;
}