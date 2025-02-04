import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { AllProviderAPRResource, AllAprProviderData } from '@jsinfo/redis/resources/ajax/AllProviderAprResource';
import { ListProvidersResource, ProviderEntry } from '@jsinfo/redis/resources/ajax/ListProvidersResource';
import { MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/MainnetProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
import GetIconForSpec from '@jsinfo/lib/icons/icons';
import { ConvertToChainName } from '@jsinfo/lib/chain-mapping/chains';
import { GetProviderAvatar } from '@jsinfo/restRpc/GetProviderAvatar';
import Decimal from 'decimal.js';

interface RewardToken {
    source_denom: string;
    resolved_amount: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    value_usd: string;
}

interface ProviderPerformanceData extends Omit<AllAprProviderData, 'rewards'> {
    '30_days_cu_served': string;
    rewards_10k_lava_delegation: RewardToken[];
    '30_days_relays_served': string;
    specs?: Array<ProviderEntry['specs'][0] & { icon?: string }>;
    stake?: string;
    stakestatus?: string;
    addons?: string;
    extensions?: string;
    delegateTotal?: string;
    rewards_last_month: Array<{
        chain: string;
        spec: string;
        tokens: RewardToken[];
        total_usd: number;
        icon?: string;
    }>;
    avatar?: string | null;
}

export const ProviderPerformanceHandlerOpts: RouteShorthandOptions = {
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
                        rewards_10k_lava_delegation: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    source_denom: { type: 'string' },
                                    resolved_amount: { type: 'string' },
                                    resolved_denom: { type: 'string' },
                                    display_denom: { type: 'string' },
                                    display_amount: { type: 'string' },
                                    value_usd: { type: 'string' }
                                }
                            }
                        },
                        rewards_last_month: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    chain: { type: 'string' },
                                    spec: { type: 'string' },
                                    tokens: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                source_denom: { type: 'string' },
                                                resolved_amount: { type: 'string' },
                                                resolved_denom: { type: 'string' },
                                                display_denom: { type: 'string' },
                                                display_amount: { type: 'string' },
                                                value_usd: { type: 'string' }
                                            }
                                        }
                                    },
                                    total_usd: { type: 'number' },
                                    icon: { type: 'string' }
                                }
                            }
                        },
                        '30_days_relays_served': { type: 'string' },
                        specs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    chain: { type: 'string' },
                                    spec: { type: 'string' },
                                    stakestatus: { type: 'string' },
                                    stake: { type: 'string' },
                                    addons: { type: 'string' },
                                    extensions: { type: 'string' },
                                    delegateCommission: { type: 'string' },
                                    delegateTotal: { type: 'string' },
                                    moniker: { type: 'string' },
                                    icon: { type: 'string' }
                                }
                            }
                        },
                        stake: { type: 'string' },
                        stakestatus: { type: 'string' },
                        addons: { type: 'string' },
                        extensions: { type: 'string' },
                        delegateTotal: { type: 'string' },
                        avatar: { type: 'string' }
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

function processRewardsBySpec(rewardsByBlock: any): Array<{ chain: string; spec: string; tokens: any[]; total_usd: number; icon?: string }> {
    if (!rewardsByBlock) return [];

    const specRewards = new Map<string, { tokens: any[]; total_usd: Decimal }>();
    const block = Object.keys(rewardsByBlock)[0];
    const info = rewardsByBlock[block]?.info || [];

    info.forEach((reward: any) => {
        const [type, spec] = reward.source.toLowerCase().split(': ');
        if (!spec) return;

        const key = spec;
        const existing = specRewards.get(key) || { tokens: [], total_usd: new Decimal(0) };

        // Sum up the tokens
        reward.amount.tokens.forEach((token: any) => {
            const existingToken = existing.tokens.find(t => t.source_denom === token.source_denom);
            if (existingToken) {
                try {
                    // Handle resolved amount addition
                    const existingResolved = existingToken.resolved_amount || '0';
                    const newResolved = token.resolved_amount || '0';
                    const newResolvedAmount = new Decimal(existingResolved)
                        .plus(new Decimal(newResolved))
                        .toString();

                    // Handle display amount addition
                    const existingDisplay = existingToken.display_amount || '0';
                    const newDisplay = token.display_amount || '0';
                    const newDisplayAmount = new Decimal(existingDisplay)
                        .plus(new Decimal(newDisplay))
                        .toString();

                    // Handle USD value addition
                    const existingUsd = new Decimal(existingToken.value_usd?.slice(1) || '0');
                    const newUsd = new Decimal(token.value_usd?.slice(1) || '0');
                    const totalUsd = existingUsd.plus(newUsd);

                    existingToken.resolved_amount = newResolvedAmount;
                    existingToken.display_amount = newDisplayAmount;
                    existingToken.value_usd = `$${totalUsd.toFixed(2)}`;
                } catch (decimalError) {
                    logger.warn('Error processing token values:', {
                        error: decimalError,
                        existingToken,
                        newToken: token,
                        context: 'processRewardsBySpec'
                    });
                    // Fallback to zero if there's an error
                    existingToken.resolved_amount = '0';
                    existingToken.display_amount = '0';
                    existingToken.value_usd = '$0.00';
                }
            } else {
                existing.tokens.push({ ...token });
            }
        });

        // Use Decimal for total_usd addition
        try {
            const rewardUsd = new Decimal(reward.amount.total_usd || 0);
            existing.total_usd = existing.total_usd.plus(rewardUsd);
        } catch (decimalError) {
            logger.warn('Error processing total USD:', {
                error: decimalError,
                reward,
                context: 'processRewardsBySpec_totalUsd'
            });
        }

        specRewards.set(key, existing);
    });

    return Array.from(specRewards.entries()).map(([spec, data]) => ({
        chain: ConvertToChainName(spec),
        spec: spec.toUpperCase(),
        tokens: data.tokens,
        total_usd: data.total_usd.toNumber(),  // Convert back to number at the end
        icon: GetIconForSpec(spec)
    }));
}

export async function ProviderPerformanceRawHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const [aprResource, providersResource, rewardsLastMonth] = await Promise.all([
            new AllProviderAPRResource().fetch(),
            new ListProvidersResource().fetch(),
            MainnetProviderEstimatedRewardsGetService.fetch({ block: 2044223 })
        ]);

        if (!aprResource || !providersResource) {
            return reply.status(400).send({ error: 'Failed to fetch provider data' });
        }

        // Create a map of providers for quick lookup
        const providersMap = new Map(
            providersResource.providers.map(p => [p.provider, p])
        );

        // Create a map of rewards for quick lookup
        const rewardsMap = new Map(
            (rewardsLastMonth?.data?.providers || []).map(p => [p.address, p.rewards_by_block])
        );

        // Combine the data
        const combinedData = await Promise.all(aprResource.map(async apr => {
            const provider = providersMap.get(apr.address);
            const rewards_last_month = processRewardsBySpec(rewardsMap.get(apr.address));
            const avatar = await GetProviderAvatar(apr.address);

            const result: ProviderPerformanceData = {
                ...apr,
                commission: apr.commission || '',
                '30_days_cu_served': apr['30_days_cu_served'] || '',
                rewards_10k_lava_delegation: apr.rewards_10k_lava_delegation,
                rewards_last_month,
                '30_days_relays_served': apr['30_days_relays_served'] || '',
                specs: provider?.specs || [],
                stake: provider?.specs?.[0]?.stake || '',
                stakestatus: provider?.specs?.[0]?.stakestatus || '',
                addons: provider?.specs?.[0]?.addons || '',
                extensions: provider?.specs?.[0]?.extensions || '',
                delegateTotal: provider?.specs?.[0]?.delegateTotal || '',
                avatar
            };

            delete (result as any).rewards;
            return result;
        }));

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(combinedData));
    } catch (error) {
        const errorDetails = {
            endpoint: 'ProviderPerformanceRawHandler',
            timestamp: new Date().toISOString(),
            errorType: typeof error,
            errorName: (error as Error)?.name,
            errorMessage: (error as Error)?.message,
            errorStack: (error as Error)?.stack,
            requestInfo: {
                method: request.method,
                url: request.url,
                params: request.params,
                query: request.query,
                headers: {
                    ...request.headers,
                    // Exclude sensitive headers if any
                    authorization: undefined
                }
            },
            systemInfo: {
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime(),
                nodeVersion: process.version
            }
        };

        logger.error('Provider Performance Handler - Critical Error:', errorDetails);
        return reply.status(500).send({
            error: 'Internal server error',
            errorId: new Date().getTime(),
            message: 'Failed to process provider performance data. Please try again later.'
        });
    }
}