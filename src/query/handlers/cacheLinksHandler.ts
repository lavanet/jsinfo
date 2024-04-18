// src/query/handlers/cacheLinksHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
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
    await QueryCheckReadDbInstance()

    const baseUrls = {
        providers: [
            '/provider',
            '/providerHealth',
            '/providerErrors',
            '/providerStakes',
            '/providerEvents',
            '/providerRewards',
            '/providerReports',
            '/providerHealthCsv',
            '/providerErrorsCsv',
            '/providerStakesCsv',
            '/providerEventsCsv',
            '/providerRewardsCsv',
            '/providerReportsCsv',
        ],
        consumers: [
            '/consumer',
        ],
        specs: [
            '/spec',
        ],
    };

    // Fetch all providers, consumers, and specs
    const providers = await QueryGetReadDbInstance().select().from(schema.providers).where(isNotNull(schema.providers.address));
    const consumers = await QueryGetReadDbInstance().select().from(schema.consumers);
    const specs = await QueryGetReadDbInstance().select().from(schema.specs);

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
        ...providerUrls,
        ...consumerUrls,
        ...specUrls,
    ];

    return {
        urls: urls
    }
}