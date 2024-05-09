// src/query/handlers/lavapProviderHealthHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbInstance } from '../queryDb';
import { lt } from "drizzle-orm";
import { JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS } from '../queryConsts';

type ProviderData = {
    provider: string;
    spec: string;
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

function validateSpec(spec: string): string {
    if (!/^[A-Z0-9]+$/.test(spec)) {
        throw new Error(`Invalid spec: ${spec}`);
    }
    return spec;
}

function parseProviderKey(key: string): [string, string, string | null] {
    const parts = key.replace(/"/g, '').split('|').map(part => part.trim());
    return [validateProvider(parts[0]), validateSpec(parts[1]), parts[2] || null];
}

function parseProvider(data: any, key: string, status: string): ProviderData {
    const [provider, spec, interfaceName] = parseProviderKey(key);
    return {
        provider,
        spec,
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
    await QueryCheckJsinfoDbInstance();

    const cdate = new Date(); // current date
    console.log(`LavapProviderHealthHandler:: Lavap Provider Health Timestamp: ${cdate}`);

    let latestBlocks = {};
    let getBlocksAway = (spec: string, currentBlock: number | null): number | null => null;

    const requestBody = request.body as any;

    if (!requestBody.latestBlocks) {
        console.error('Error: latestBlocks key does not exist in the request body');
    } else {
        latestBlocks = requestBody.latestBlocks;

        getBlocksAway = (spec: string, currentBlock: number | null): number | null => {
            if (currentBlock == null || currentBlock === 0) return null
            const block = latestBlocks[spec];
            if (block === undefined) {
                console.error(`Error: Spec ${spec} does not exist in latestBlocks`);
                return null;
            }
            return block - currentBlock;
        };
    }

    const providerData: ProviderData[] = parseData(request.body);

    const insertData: JsinfoSchema.InsertProviderHealthHourly[] = providerData.map(data => {
        let blocksaway: number | null = null
        if (data.status === 'healthy') blocksaway = getBlocksAway(data.spec, data.block);
        return {
            provider: data.provider,
            timestamp: cdate,
            spec: data.spec,
            interface: data.interface,
            status: data.status,
            message: data.message,
            block: data.block,
            blocksaway: blocksaway,
            latency: data.latency,
        };
    });

    await QueryGetJsinfoDbInstance().transaction(async (tx) => {
        console.log(`Starting transaction. Inserting ${insertData.length} records.`);

        // Get the current hour
        const currentHour = new Date().getHours();

        // Check if the current hour is between 3 and 4 AM
        if (currentHour === 3) {
            // Delete entries older than JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS (30 days)
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS);
            await tx.delete(JsinfoSchema.providerHealthHourly).where(lt(JsinfoSchema.providerHealthHourly.timestamp, cutoffDate));
        }

        // insert in bulk
        const result = await tx.insert(JsinfoSchema.providerHealthHourly).values(insertData);
        console.log(`Transaction completed. Inserted: ${JSON.stringify(result)} `);
    });

    // Print stats
    const healthyProviders = insertData.filter(data => data.status === 'healthy');
    const frozenProviders = insertData.filter(data => data.status === 'frozen');
    const unhealthyProviders = insertData.filter(data => data.status === 'unhealthy');

    const uniqueHealthyProviders = [...new Set(healthyProviders.map(data => data.provider))];
    console.log(`Healthy (count: ${uniqueHealthyProviders.length}): ${uniqueHealthyProviders.slice(0, 4).join(', ')}`);

    const uniqueFrozenProviders = [...new Set(frozenProviders.map(data => data.provider))];
    console.log(`Frozen (count: ${uniqueFrozenProviders.length}): ${uniqueFrozenProviders.slice(0, 4).join(', ')}`);

    const uniqueUnhealthyProviders = [...new Set(unhealthyProviders.map(data => data.provider))];
    console.log(`Unhealthy (count: ${uniqueUnhealthyProviders.length}): ${uniqueUnhealthyProviders.slice(0, 4).join(', ')}`);

    return { "status": "ok" }
}