// src/query/handlers/autoCompleteLinksV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { MonikerCache } from '../../classes/MonikerCache';
import { SpecAndConsumerCache } from '../../classes/SpecAndConsumerCache';

export const AutoCompleteLinksV2PaginatedHandlerOpts: RouteShorthandOptions = {
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

export async function AutoCompleteLinksV2PaginatedHandler(request: FastifyRequest, reply: FastifyReply) {

    const baseUrls = {
        providers: [
            '/provider',
        ],
        consumers: [
            '/consumer',
        ],
        specs: [
            '/chain',
        ],
    };

    // Fetch all providers, consumers, and specs
    const providers = MonikerCache.GetAllProviders();
    const consumers = SpecAndConsumerCache.GetAllConsumers();
    const specs = SpecAndConsumerCache.GetAllSpecs();

    // Generate URLs for each provider, consumer, and spec
    const providerItems = providers.flatMap(provider =>
        baseUrls.providers.map(baseUrl => ({
            id: 'provider-' + provider,
            name: provider,
            type: 'provider',
            link: `${baseUrl}/${provider}`,
            moniker: MonikerCache.GetMonikerForProvider(provider)
        }))
    );

    const consumerItems = consumers.flatMap(consumer =>
        baseUrls.consumers.map(baseUrl => ({
            id: 'consumer-' + consumer,
            name: consumer,
            type: 'consumer',
            link: `${baseUrl}/${consumer}`,
            moniker: MonikerCache.GetMonikerForProvider(consumer)
        }))
    );

    const specItems = specs.flatMap(spec =>
        baseUrls.specs.map(baseUrl => ({
            id: 'spec-' + spec,
            name: spec,
            type: 'spec',
            link: `${baseUrl}/${spec}`,
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