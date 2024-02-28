// src/query/handlers/lavapProviderHealthHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as schema from '../../schema';
import { CheckDbInstance, GetDbInstance } from '../dbUtils';
import { gt } from "drizzle-orm";
import { JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS } from '../consts';

type ProviderData = {
    provider: string;
    chain: string;
    interface: string | null;
    status: string;
    message: string | null;
    block: number | null;
    latency: number | null;
};

function validateProvider(provider: string): string {
    if (!provider.startsWith('lava@')) {
        throw new Error(`Invalid provider: ${provider}`);
    }
    return provider;
}

function validateChain(chain: string): string {
    if (!/^[A-Z0-9]+$/.test(chain)) {
        throw new Error(`Invalid chain: ${chain}`);
    }
    return chain;
}

function parseProviderKey(key: string): [string, string, string | null] {
    const parts = key.replace(/"/g, '').split('|').map(part => part.trim());
    return [validateProvider(parts[0]), validateChain(parts[1]), parts[2] || null];
}

function parseProvider(data: any, key: string, status: string): ProviderData {
    const [provider, chain, interfaceName] = parseProviderKey(key);
    return {
        provider,
        chain,
        interface: interfaceName,
        status,
        message: status === 'unhealthy' ? data[key] : null,
        block: data[key]?.block || null,
        latency: data[key]?.latency || null
    };
}

function parseData(data: any): ProviderData[] {
    const result: ProviderData[] = [];

    for (const key in data.providerData) {
        result.push(parseProvider(data.providerData, key, 'healthy'));
    }

    for (const key in data.frozenProviders) {
        result.push(parseProvider(data.frozenProviders, key, 'frozen'));
    }

    for (const key in data.unhealthyProviders) {
        result.push(parseProvider(data.unhealthyProviders, key, 'unhealthy'));
    }

    return result;
}

export const LavapProviderHealthHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    status: {
                        type: 'string'
                    },
                }
            }
        }
    }
}



export async function LavapProviderHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckDbInstance();

    const cdate = new Date(); // current date
    console.log(`Lavap Provider Health Timestamp: ${cdate}`);

    const providerData: ProviderData[] = parseData(request.body);

    const insertData: schema.InsertProviderHealthHourly[] = providerData.map(data => ({
        provider: data.provider,
        timestamp: cdate,
        spec: data.chain,
        interface: data.interface,
        status: data.status,
        message: data.message,
        block: data.block,
        latency: data.latency,
    }));

    await GetDbInstance().transaction(async (tx) => {
        console.log(`Starting transaction. Inserting ${insertData.length} records.`);

        // Delete entries older than 60 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS);
        await tx.delete(schema.providerHealthHourly).where(gt(schema.providerHealthHourly.timestamp, cutoffDate));


        const result = await tx.insert(schema.providerHealthHourly).values(insertData);
        console.log(`Transaction completed. Inserted: ${result} `);
    });

    // Print stats
    const healthyProviders = insertData.filter(data => data.status === 'healthy');
    const frozenProviders = insertData.filter(data => data.status === 'frozen');
    const unhealthyProviders = insertData.filter(data => data.status === 'unhealthy');

    const uniqueHealthyProviders = [...new Set(healthyProviders.map(data => data.provider))];
    console.log(`Healthy (count: ${uniqueHealthyProviders.length}): ${uniqueHealthyProviders.join(', ')}`);

    const uniqueFrozenProviders = [...new Set(frozenProviders.map(data => data.provider))];
    console.log(`Frozen (count: ${uniqueFrozenProviders.length}): ${uniqueFrozenProviders.join(', ')}`);

    const uniqueUnhealthyProviders = [...new Set(unhealthyProviders.map(data => data.provider))];
    console.log(`Unhealthy (count: ${uniqueUnhealthyProviders.length}): ${uniqueUnhealthyProviders.join(', ')}`);

    return { "status": "ok" }
}