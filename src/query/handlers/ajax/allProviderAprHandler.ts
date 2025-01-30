import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AllProviderAPRResource, AllAprProviderData } from '@jsinfo/redis/resources/ajax/AllProviderAprResource';
import { ListProvidersResource, ProviderEntry } from '@jsinfo/redis/resources/ajax/ListProvidersResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

interface RewardToken {
    denom: string;
    amount: string;
}

interface ProviderAPRData extends Omit<AllAprProviderData, 'rewards'> {
    '30_days_cu_served': string;
    rewards: RewardToken[];
    '30_days_relays_served': string;
    specs?: ProviderEntry['specs'];
    stake?: string;
    stakestatus?: string;
    addons?: string;
    extensions?: string;
    delegateTotal?: string;
}

export const AllProviderAPRRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        address: { type: 'string' },
                        moniker: { type: 'string' },
                        apr: { type: 'string' },
                        commission: { type: 'string' },
                        '30_days_cu_served': { type: 'string' },
                        rewards: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    denom: { type: 'string' },
                                    amount: { type: 'string' }
                                }
                            }
                        },
                        stake: { type: 'string' },
                        stakestatus: { type: 'string' },
                        addons: { type: 'string' },
                        extensions: { type: 'string' },
                        delegateTotal: { type: 'string' },
                        '30_days_relays_served': { type: 'string' },
                        specs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    spec: { type: 'string' },
                                    chain: { type: 'string' },
                                    stakestatus: { type: 'string' },
                                    stake: { type: 'string' },
                                    addons: { type: 'string' },
                                    extensions: { type: 'string' },
                                    delegateCommission: { type: 'string' },
                                    delegateTotal: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
};

export async function AllProviderAPRRawHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const [aprResource, providersResource] = await Promise.all([
            new AllProviderAPRResource().fetch(),
            new ListProvidersResource().fetch()
        ]);

        if (!aprResource || !providersResource) {
            return reply.status(400).send({ error: 'Failed to fetch provider data' });
        }

        // Create a map of providers for quick lookup
        const providersMap = new Map(
            providersResource.providers.map(p => [p.provider, p])
        );

        // Combine the data
        const combinedData = aprResource.map(apr => {
            const provider = providersMap.get(apr.address);
            const result: ProviderAPRData = {
                ...apr,
                '30_days_cu_served': apr['30_days_cu_served'] || '',
                rewards: Object.values(apr.rewards).map(reward => ({
                    denom: reward.denom,
                    amount: reward.amount
                })),
                '30_days_relays_served': apr['30_days_relays_served'] || '',
                specs: provider?.specs || [],
                stake: provider?.specs?.[0]?.stake || '',
                stakestatus: provider?.specs?.[0]?.stakestatus || '',
                addons: provider?.specs?.[0]?.addons || '',
                extensions: provider?.specs?.[0]?.extensions || '',
                delegateTotal: provider?.specs?.[0]?.delegateTotal || ''
            };
            return result;
        });

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(combinedData));
    } catch (error) {
        logger.error('Error in AllProviderAPRRawHandler:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}