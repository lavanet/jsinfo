// src/query/handlers/ListProvidersRawHandler.ts

// curl http://localhost:8081/listProviders | jq
// curl http://localhost:8081/listProviders | jq | grep ">"

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProvidersData, ListProvidersResource } from '@jsinfo/redis/resources/ajax/ListProvidersResource';
import { GetProviderAvatar } from '@jsinfo/restRpc/GetProviderAvatar';

export const ListProvidersRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            height: { type: 'number' },
                            datetime: { type: 'number' },
                            providers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        provider: { type: 'string' },
                                        avatar: { type: ['string', 'null'] },
                                        specs: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    chain: { type: 'string' },
                                                    spec: { type: 'string' },
                                                    moniker: { type: 'string' },
                                                    stakestatus: { type: 'string' },
                                                    stake: { type: 'string' },
                                                    addons: { type: 'string' },
                                                    extensions: { type: 'string' },
                                                    delegateCommission: { type: 'string' },
                                                    delegateTotal: { type: 'string' },
                                                    icon: { type: 'string' }
                                                },
                                                required: ['spec', 'moniker']
                                            }
                                        }
                                    },
                                    required: ['provider', 'specs']
                                }
                            }
                        },
                        required: ['height', 'datetime', 'providers']
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
};

export interface ProviderData {
    provider: string;
    specs: {
        chain: string;
        spec: string | null;
        moniker: string;
        stakestatus: string | null;
        stake: string | null;
        addons: string | null;
        extensions: string | null;
        delegateCommission: string | null;
        delegateTotal: string | null;
        icon?: string;
    }[];
}

export interface ProvidersResponse {
    height: number;
    datetime: number;
    providers: ProviderData[];
}

export async function ListProvidersRawHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<{ data: ProvidersResponse }> {
    const resource = new ListProvidersResource();
    const data = await resource.fetch();
    if (!data) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch providers data' });
        return reply;
    }

    // Add avatars to providers
    const providersWithAvatars = {
        height: data.height,
        datetime: data.datetime,
        providers: await Promise.all(data.providers.map(async (provider: ProviderData) => ({
            provider: provider.provider,
            avatar: await GetProviderAvatar(provider.provider),
            specs: provider.specs
        })))
    };

    return { data: providersWithAvatars };
}