// src/query/handlers/indexProvidersActiveHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IndexProvidersActiveResource } from '@jsinfo/redis/resources/index/IndexProvidersActiveResource';
import { logger } from '@jsinfo/utils/logger';
import { IndexProvidersActiveV2Service } from '@jsinfo/redis/resources/index/IndexProvidersActiveV2Resource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export interface IndexProviderActiveV2Response {
    provider: string;
    moniker: string;
    monikerfull: string;
    totalServices: string;
    totalStake: string;
    rewardsUSD?: string;
    rewardsULAVA?: string;
}

export interface IndexProvidersActiveV2Response {
    data: IndexProviderActiveV2Response[];
}

// Export the interface so it can be used in queryRoutes.ts
export interface IndexProvidersActiveV2Querystring {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    pagination?: string;
}

// Helper function to parse values for sorting with support for different field types
function parseValueForSorting(item: any, sortBy: string): number {
    // Special handling for reputation score - use the numeric field directly
    if (sortBy === 'formattedReputationScore' && 'reputationScore' in item) {
        // If reputationScore is null, it will appear as "-" in the UI
        if (item.reputationScore === null) {
            return -Infinity; // Place at the very end when sorting in descending order
        }
        return item.reputationScore;
    }

    // Handle missing properties gracefully
    if (!item || !(sortBy in item)) {
        return -Infinity; // For descending sort, this will be last
    }

    const value = item[sortBy];

    // Handle null/undefined
    if (value === null || value === undefined) {
        return -Infinity;
    }

    // Check for dash/minus sign alone, which indicates no value
    if (value === '-' || value === '') {
        return -Infinity;
    }

    // For raw numeric fields, check for the equivalent raw field
    const rawFieldMap: { [key: string]: string } = {
        'totalStake': 'totalStakeRaw',
        'activeStake': 'activeStakeRaw',
        'activeDelegate': 'activeDelegateRaw',
        'activeDelegateAndStakeTotal': 'activeDelegateAndStakeTotalRaw',
        'activeAndInactiveStake': 'activeAndInactiveStakeRaw',
        'activeAndInactiveDelegateStake': 'activeAndInactiveDelegateStakeRaw',
        'activeAndInactiveStakeTotal': 'activeAndInactiveStakeTotalRaw'
    };

    // If we're sorting by a field that has a raw counterpart, use the raw value
    if (sortBy in rawFieldMap && rawFieldMap[sortBy] in item) {
        const rawValue = item[rawFieldMap[sortBy]];

        // If raw value is 0, put it at the end
        if (rawValue === 0 || rawValue === '0' || rawValue === BigInt(0)) {
            return -Infinity;
        }

        return Number(rawValue);
    }

    // For numeric values
    if (typeof value === 'number') {
        // Put zeros at the end
        if (value === 0) {
            return -Infinity;
        }
        return value;
    }

    // For string values that might contain numbers with formatting
    if (typeof value === 'string') {
        // Remove currency symbols, "lava", and commas
        const cleaned = value.replace(/[$,]/g, '')
            .replace(/lava/gi, '')
            .replace(/ulava/gi, '')
            .trim();

        // Check if the result is just "0" or "0.00"
        if (cleaned === '0' || cleaned === '0.00' || cleaned === '0.0') {
            return -Infinity;
        }

        const num = parseFloat(cleaned);
        return isNaN(num) ? -Infinity : num;
    }

    return -Infinity;
}

// Helper function to map URL parameter names to actual field names
function mapSortFieldName(fieldName: string): string {
    // Map of URL parameter names to actual field names
    const fieldMap: { [key: string]: string } = {
        'stake': 'activeAndInactiveStakeTotal',        // Map "stake" to the combined total field
        'activeStake': 'activeStake',
        'services': 'activeServices',                  // Map "services" to activeServices
        'totalServices': 'totalServices',
        'reputation': 'reputationScore',
        'formattedReputation': 'formattedReputationScore',
        'rank': 'rank',
        'moniker': 'moniker',
        'provider': 'moniker'
    };

    return fieldMap[fieldName] || fieldName;
}

export const IndexProvidersActiveV2PaginatedHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActiveV2PaginatedHandler(
    request: FastifyRequest<{
        Querystring: IndexProvidersActiveV2Querystring
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

        // Map the sort field name to the actual field name
        sortBy = mapSortFieldName(sortBy);

        const allProviders = await IndexProvidersActiveV2Service.fetch();

        if (!allProviders || allProviders.length === 0) {
            return reply.status(404).send({ error: 'No active providers found' });
        }

        // Sort providers with improved value parsing
        const sortedProviders = [...allProviders].sort((a, b) => {
            // Special case for rank field specifically
            if (sortBy === 'rank') {
                // Special handling for rank field, which should never be null now
                const rankA = a.rank !== null ? a.rank : 999999;
                const rankB = b.rank !== null ? b.rank : 999999;

                // Apply direction
                return sortDirection === 'asc'
                    ? rankA - rankB
                    : rankB - rankA;
            }

            // For regular fields
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

export const IndexProvidersActiveV2ItemCountPaginatiedHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActiveV2ItemCountPaginatiedHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<{ itemCount: number }> {
    try {
        const providers = await IndexProvidersActiveV2Service.fetch();
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

export const IndexProvidersActiveV2CSVRawHandlerOpts: RouteShorthandOptions = {
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

export async function IndexProvidersActiveV2CSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const providers = await IndexProvidersActiveV2Service.fetch();

        if (!providers || providers.length === 0) {
            reply.status(400);
            reply.send({ error: 'Data is unavailable now' });
            return reply;
        }

        const csv = await IndexProvidersActiveV2Service.ConvertRecordsToCsv(providers);
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

