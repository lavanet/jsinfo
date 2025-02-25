// src/query/handlers/indexProvidersActiveHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexProvidersActiveResource } from '@jsinfo/redis/resources/index/IndexProvidersActiveResource';
import { logger } from '@jsinfo/utils/logger';
import { IndexProvidersActiveService } from '@jsinfo/redis/resources/index/IndexProvidersActiveResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export interface IndexProviderActiveResponse {
    provider: string;
    moniker: string;
    monikerfull: string;
    totalServices: string;
    totalStake: string;
    rewardsUSD?: string;
    rewardsULAVA?: string;
}

export interface IndexProvidersActiveResponse {
    data: IndexProviderActiveResponse[];
}

// Export the interface so it can be used in queryRoutes.ts
export interface IndexProvidersActiveQuerystring {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    pagination?: string;
}

// Helper function to parse values for sorting with support for different field types
function parseValueForSorting(item: any, sortBy: string): number {
    // Handle missing properties gracefully
    if (!item || !(sortBy in item)) {
        return Number.MAX_VALUE;
    }

    const value = item[sortBy];

    // Handle null/undefined
    if (value === null || value === undefined) {
        return Number.MAX_VALUE;
    }

    // For stake values, use rawTotalStake if sorting by totalStake
    if (sortBy === 'totalStake' && 'rawTotalStake' in item && item.rawTotalStake !== undefined) {
        return Number(item.rawTotalStake);
    }

    // For numeric values
    if (typeof value === 'number') {
        return value;
    }

    // For string values that might contain numbers with formatting
    if (typeof value === 'string') {
        // Remove currency symbols, "lava", and commas
        const cleaned = value.replace(/[$,]/g, '')
            .replace(/lava/gi, '')
            .replace(/ulava/gi, '')
            .trim();

        const num = parseFloat(cleaned);
        return isNaN(num) ? Number.MAX_VALUE : num;
    }

    return Number.MAX_VALUE;
}

export const IndexProvidersActivePaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                sortBy: { type: 'string' },
                sortDirection: { type: 'string', enum: ['asc', 'desc'] },
                pagination: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

export async function IndexProvidersActivePaginatedHandler(
    request: FastifyRequest<{
        Querystring: IndexProvidersActiveQuerystring
    }>,
    reply: FastifyReply
) {
    try {
        // Handle pagination string format (e.g., "rank,a,1,20")
        let page = 1;
        let limit = 10;
        let sortBy = 'rank';
        let sortDirection = 'asc';

        if (request.query.pagination) {
            const parts = request.query.pagination.split(',');
            if (parts.length >= 1) sortBy = parts[0] || sortBy;
            if (parts.length >= 2) sortDirection = (parts[1] === 'a' || parts[1] === 'asc') ? 'asc' : 'desc';
            if (parts.length >= 3) page = parseInt(parts[2]) || page;
            if (parts.length >= 4) limit = parseInt(parts[3]) || limit;
        } else {
            // If no pagination string, use individual parameters
            page = parseInt(request.query.page as any) || 1;
            limit = parseInt(request.query.limit as any) || 10;
            sortBy = request.query.sortBy || 'rank';
            sortDirection = request.query.sortDirection || 'asc';
        }

        const allProviders = await IndexProvidersActiveService.fetch();

        if (!allProviders || allProviders.length === 0) {
            return reply.status(404).send({ error: 'No active providers found' });
        }

        // Sort providers with improved value parsing
        const sortedProviders = [...allProviders].sort((a, b) => {
            // Special handling for different field types
            const valueA = parseValueForSorting(a, sortBy);
            const valueB = parseValueForSorting(b, sortBy);

            // Apply direction
            return sortDirection === 'asc'
                ? valueA - valueB
                : valueB - valueA;
        });

        // Calculate pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProviders = sortedProviders.slice(startIndex, endIndex);

        const response = {
            data: paginatedProviders,
            pagination: {
                total: allProviders.length,
                page,
                limit,
                pages: Math.ceil(allProviders.length / limit)
            }
        };

        reply.header('Content-Type', 'application/json');
        return JSONStringify(response);
    } catch (error) {
        logger.error('Error in IndexProvidersActivePaginatedHandler:', error);
        return reply.status(500).send({ error: 'Internal server error' });
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

export async function IndexProvidersActiveItemCountPaginatiedHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<{ itemCount: number }> {
    try {
        const providers = await IndexProvidersActiveService.fetch();
        if (!providers) {
            throw new Error("Failed to fetch providers");
        }
        return { itemCount: providers.length };
    } catch (error) {
        logger.error('Error fetching active providers count:', error);
        reply.status(400);
        reply.send({ error: 'Failed to fetch active providers count' });
        return reply;
    }
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
    try {
        const providers = await IndexProvidersActiveService.fetch();

        if (!providers || providers.length === 0) {
            reply.status(400);
            reply.send({ error: 'Data is unavailable now' });
            return reply;
        }

        const csv = await new IndexProvidersActiveResource().ConvertRecordsToCsv(providers);
        if (!csv) {
            reply.status(400);
            reply.send({ error: 'Data is not available in CSV format' });
            return reply;
        }

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="LavaActiveProviders.csv"`);
        return csv;
    } catch (error) {
        logger.error('Error generating CSV:', error);
        reply.status(500);
        reply.send({ error: 'Failed to generate CSV' });
        return reply;
    }
}

