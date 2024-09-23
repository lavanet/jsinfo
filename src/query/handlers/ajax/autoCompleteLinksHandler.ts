// src/query/handlers/autoCompleteLinksHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { isNotNull } from 'drizzle-orm';
import { MonikerCache } from '../../classes/MonikerCache';

export const AutoCompleteLinksPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                    },
                }
            }
        }
    }
}

export async function AutoCompleteLinksPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const baseUrls = {
        providers: [
            '/provider',
        ],
        consumers: [
            '/consumer',
        ],
        specs: [
            '/spec',
        ],
    };

    // Fetch all providers, consumers, and specs
    const providers = await QueryGetJsinfoReadDbInstance()
        .select({
            address: JsinfoSchema.providerSpecMoniker.provider
        })
        .from(JsinfoSchema.providerSpecMoniker)
        .where(isNotNull(JsinfoSchema.providerSpecMoniker.provider))
        .groupBy(JsinfoSchema.providerSpecMoniker.provider);

    const consumers = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumers);
    const specs = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs);

    // Generate URLs for each provider, consumer, and spec
    const providerItems = providers.flatMap(provider =>
        baseUrls.providers.map(baseUrl => ({
            id: 'provider-' + provider.address,
            name: provider.address,
            type: 'provider',
            link: `${baseUrl}/${provider.address}`,
            moniker: MonikerCache.GetMonikerForProvider(provider.address)
        }))
    );

    const consumerItems = consumers.flatMap(consumer =>
        baseUrls.consumers.map(baseUrl => ({
            id: 'consumer-' + consumer.address,
            name: consumer.address,
            type: 'consumer',
            link: `${baseUrl}/${consumer.address}`,
            moniker: MonikerCache.GetMonikerForProvider(consumer.address)
        }))
    );

    const specItems = specs.flatMap(spec =>
        baseUrls.specs.map(baseUrl => ({
            id: 'spec-' + spec.id,
            name: spec.id,
            type: 'spec',
            link: `${baseUrl}/${spec.id}`,
            moniker: ''
        }))
    );

    const items = [
        ...providerItems,
        ...consumerItems,
        ...specItems,
    ];

    return {
        data: items
    }
}