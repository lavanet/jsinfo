// src/query/handlers/cacheLinksHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { isNotNull } from 'drizzle-orm';

export const CacheLinksHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    urls: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function CacheLinksHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const baseUrls = {
        providers: [
            '/provider',
            '/providerHealth',
            '/providerErrors',
            '/providerStakes',
            '/providerEvents',
            '/providerRewards',
            '/providerReports',
            '/providerDelegatorRewards',
            '/providerBlockReports',
            '/providerHealthCsv',
            '/providerErrorsCsv',
            '/providerStakesCsv',
            '/providerEventsCsv',
            '/providerRewardsCsv',
            '/providerReportsCsv',
            '/providerDelegatorRewardsCsv',
            '/providerBlockReportsCsv',
        ],
        consumers: [
            '/consumer',
        ],
        specs: [
            '/spec',
        ],
    };

    // Fetch all providers, consumers, and specs
    const providers = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(isNotNull(JsinfoSchema.providers.address));
    const consumers = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumers);
    const specs = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs);

    // Generate URLs for each provider, consumer, and spec
    const providerUrls = providers.flatMap(provider =>
        baseUrls.providers.map(baseUrl => `${baseUrl}/${provider.address}`)
    );
    const consumerUrls = consumers.flatMap(consumer =>
        baseUrls.consumers.map(baseUrl => `${baseUrl}/${consumer.address}`)
    );
    const specUrls = specs.flatMap(spec =>
        baseUrls.specs.map(baseUrl => `${baseUrl}/${spec.id}`)
    );

    const urls = [
        '/index',
        '/indexProviders',
        '/indexProvidersCsv',
        '/events',
        '/eventsEvents',
        '/eventsRewards',
        '/eventsReports',
        ...providerUrls,
        ...consumerUrls,
        ...specUrls,
    ];

    return {
        urls: urls
    }
}