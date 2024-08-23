// src/query/handlers/indexCachedMetricsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { RedisCache } from '../../classes/RedisCache';
import { JSINFO_QUERY_NETWORK } from '../../queryConsts';

export const IndexCachedMetricsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    cacheHitRate: {
                        type: 'number'
                    }
                }
            }
        }
    }
}

export async function IndexCachedMetricsHandler(request: FastifyRequest, reply: FastifyReply) {

    const cacheHitRateData = await RedisCache.getDictNoKeyPrefix("jsinfo-healthp-cachedmetrics") || {};

    let sum = 0;
    let count = 0;

    if (JSINFO_QUERY_NETWORK === 'mainnet') {
        for (const [key, value] of Object.entries(cacheHitRateData)) {
            if (key.toUpperCase() === 'LAVA' && value !== 0) {
                sum += value;
                count++;
            }
        }
    } else {
        for (const [key, value] of Object.entries(cacheHitRateData)) {
            if (key.toUpperCase() !== 'LAVA' && value !== 0) {
                sum += value;
                count++;
            }
        }
    }

    const cacheHitRateAverage = count > 0 ? sum / count : 0;

    return {
        cacheHitRate: cacheHitRateAverage.toFixed(2),
    }
}
