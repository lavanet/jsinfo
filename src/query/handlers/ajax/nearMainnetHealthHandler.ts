import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { NearHealthResource } from '@jsinfo/redis/resources/ajax/NearHealthResource';
import { logger } from '@jsinfo/utils/logger';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const NearMainnetHealthHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            420: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            },
        }
    }
};

export async function NearMainnetHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const resource = new NearHealthResource();
        const fullHealthData = await resource.fetch();

        if (!fullHealthData || !fullHealthData.mainnet) {
            reply.status(400);
            return { error: 'No mainnet health data available' };
        }

        // Extract only the mainnet data
        const mainnetData = {
            network: 'mainnet',
            ...fullHealthData.mainnet,
            lastUpdated: fullHealthData.lastUpdated
        };

        // Set appropriate HTTP status based on health
        if (mainnetData.overallStatus !== 'healthy') {
            reply.status(420);
        }

        reply.header('Content-Type', 'application/json');
        return JSONStringify(mainnetData);
    } catch (error) {
        logger.error('Error in NearMainnetHealthHandler:', error);
        reply.status(400);
        return { error: 'Failed to fetch NEAR mainnet health data' };
    }
} 