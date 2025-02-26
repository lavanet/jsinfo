// src/query/handlers/indexProvidersActiveHandler.ts

// curl http://localhost:8081/indexProviders | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ParsePaginationFromRequest } from '@jsinfo/query/utils/queryPagination';
import { GetDataLength } from '@jsinfo/utils/fmt';
import { IndexProvidersActiveResource } from '@jsinfo/redis/resources/index/IndexProvidersActiveResource';
import { MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { IsMainnet } from '@jsinfo/utils/env';
import { logger } from '@jsinfo/utils/logger';
import { GetResourceResponse } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';

export interface IndexProviderActiveResponse {
    provider: string;
    moniker: string;
    monikerfull: string;
    rewardSum: string;
    totalServices: string;
    totalStake: string;
    rewardsUSD?: string;
    rewardsULAVA?: string;
}

export interface IndexProvidersActiveResponse {
    data: IndexProviderActiveResponse[];
}

interface ProviderData extends IndexProviderActiveResponse {
    rewardsUSD: string;
    rewardsULAVA: string;
}

export const IndexProvidersActivePaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                provider: { type: 'string' },
                                moniker: { type: 'string' },
                                monikerfull: { type: 'string' },
                                rewardSum: { type: 'string' },
                                totalServices: { type: 'string' },
                                totalStake: { type: 'string' },
                                rewardsUSD: { type: 'string' },
                                rewardsULAVA: { type: 'string' },
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
}

export async function IndexProvidersActivePaginatedHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<IndexProvidersActiveResponse | null> {
    try {
        const resource = new IndexProvidersActiveResource();
        const pagination = ParsePaginationFromRequest(request) ?? undefined;

        const result = await resource.fetch({
            type: 'paginated',
            pagination
        }).catch(error => {
            logger.error('Error fetching from resource:', error);
            return null;
        });

        if (!result?.data) {
            reply.status(400);
            reply.send({ error: 'Failed to fetch active providers data' });
            return null;
        }

        // Cast the data array to allow adding rewards fields
        const providers = result.data as unknown as ProviderData[];

        let rewardsResponse: GetResourceResponse | null = null;
        if (IsMainnet()) {
            try {
                rewardsResponse = await MainnetProviderEstimatedRewardsGetService.fetch({
                    block: 'latest_distributed'
                });
            } catch (error) {
                logger.error('Error fetching rewards data:', error);
            }
        }

        if (rewardsResponse?.data) {
            logger.info('Processing rewards data...');

            providers.forEach(provider => {
                const providerData = rewardsResponse?.data.providers?.find(p => p.address === provider.provider);
                logger.info(`Looking for provider ${provider.provider} - Found: ${!!providerData}`);

                const rewardsLastMonthBlock = rewardsResponse?.data?.metadata.block_info?.height;
                if (!rewardsLastMonthBlock) {
                    throw new Error('Failed to fetch rewards last month block');
                }

                if (providerData?.rewards_by_block[rewardsLastMonthBlock]?.total) {
                    const total = providerData.rewards_by_block[rewardsLastMonthBlock].total;
                    provider.rewardsUSD = `$${total.total_usd.toFixed(2)}`;
                    const lavaToken = total.tokens.find(t => t.display_denom === 'lava');
                    provider.rewardsULAVA = lavaToken ? lavaToken.resolved_amount : "-";
                    logger.info(`Set rewards for ${provider.provider}: USD=${provider.rewardsUSD}, ULAVA=${provider.rewardsULAVA}`);
                } else {
                    provider.rewardsUSD = "-";
                    provider.rewardsULAVA = "-";
                    logger.info(`No rewards found for ${provider.provider}`);
                }
            });

            // Handle sorting
            const sortKey = pagination?.sortKey?.toLowerCase();
            if (pagination && (sortKey === 'rewardsusd' || sortKey === 'rewardsulava')) {
                logger.info(`Sorting by ${sortKey}`);

                // Get all providers first before sorting
                const allProviders = [...providers];

                allProviders.sort((a, b) => {
                    let aValue: number, bValue: number;

                    if (sortKey === 'rewardsusd') {
                        // Parse USD values, removing '$' and handling '-'
                        aValue = a.rewardsUSD === '-' ? 0 : parseFloat(a.rewardsUSD.replace('$', ''));
                        bValue = b.rewardsUSD === '-' ? 0 : parseFloat(b.rewardsUSD.replace('$', ''));
                    } else {
                        // Parse ULAVA values, handling '-'
                        aValue = a.rewardsULAVA === '-' ? 0 : parseFloat(a.rewardsULAVA);
                        bValue = b.rewardsULAVA === '-' ? 0 : parseFloat(b.rewardsULAVA);
                    }

                    // Handle NaN values
                    if (isNaN(aValue)) aValue = 0;
                    if (isNaN(bValue)) bValue = 0;

                    logger.debug(`Comparing ${a.provider} (${aValue}) with ${b.provider} (${bValue})`);

                    return pagination.direction === 'ascending'
                        ? aValue - bValue
                        : bValue - aValue;
                });

                // Apply pagination after sorting
                if (pagination.page && pagination.count) {
                    const startIdx = (pagination.page - 1) * pagination.count;
                    const endIdx = startIdx + pagination.count;
                    // Replace providers array with sorted and paginated results
                    providers.length = 0;
                    providers.push(...allProviders.slice(startIdx, endIdx));
                }
            }
        } else {
            logger.warn('No rewards response data available');
            providers.forEach(p => {
                p.rewardsUSD = "-data not available-";
                p.rewardsULAVA = "-data not available-";
            });
        }

        return { data: providers };
    } catch (error) {
        logger.error('Error in IndexProvidersActivePaginatedHandler:', error);
        if (!reply.sent) {
            reply.status(500);
            reply.send({ error: 'Internal server error' });
        }
        return null;
    }
}

export const IndexProvidersActiveItemCountPaginatiedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    itemCount: { type: 'number' }
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
}

export async function IndexProvidersActiveItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ itemCount: number }> {
    const resource = new IndexProvidersActiveResource();
    const result = await resource.fetch({ type: 'count' });
    if (!result || (typeof result.count !== 'number' && typeof result.count !== 'string')) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers count' });
        return reply;
    }
    const count = typeof result.count === 'string' ? parseInt(result.count, 10) : result.count;
    return { itemCount: count };
}

export const IndexProvidersActiveCSVRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}

export async function IndexProvidersActiveCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new IndexProvidersActiveResource();
    const result = await resource.fetch({ type: 'all' });
    if (!result) {
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers data' });
        return reply;
    }

    if (!result.data || GetDataLength(result.data) === 0) {
        reply.status(400);
        reply.send({ error: 'Data is unavailable now' });
        return reply;
    }

    const csv = await resource.ConvertRecordsToCsv(result.data);
    if (!csv) {
        reply.status(400);
        reply.send({ error: 'Data is not available in CSV format' });
        return reply;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="LavaActiveProviders.csv"`);
    return csv;
}