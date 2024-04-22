// src/query/handlers/autoCompleteLinksHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckReadDbInstance, QueryGetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { isNotNull } from 'drizzle-orm';

export const AutoCompleteLinksHandlerOpts: RouteShorthandOptions = {
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

export async function AutoCompleteLinksHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckReadDbInstance()

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
    const providers = await QueryGetReadDbInstance().select().from(schema.providers).where(isNotNull(schema.providers.address));
    const consumers = await QueryGetReadDbInstance().select().from(schema.consumers);
    const specs = await QueryGetReadDbInstance().select().from(schema.specs);

    // Generate URLs for each provider, consumer, and spec
    const providerItems = providers.flatMap(provider =>
        baseUrls.providers.map(baseUrl => ({
            id: 'provider-' + provider.address,
            name: provider.address,
            type: 'provider',
            link: `${baseUrl}/${provider.address}`,
            moniker: provider.moniker
        }))
    );
    const consumerItems = consumers.flatMap(consumer =>
        baseUrls.consumers.map(baseUrl => ({
            id: 'consumer-' + consumer.address,
            name: consumer.address,
            type: 'consumer',
            link: `${baseUrl}/${consumer.address}`,
            moniker: ''
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