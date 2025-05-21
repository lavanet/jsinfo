import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { NearHealthResource } from '@jsinfo/redis/resources/ajax/NearHealthResource';
import { logger } from '@jsinfo/utils/logger';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const NearTestnetHealthHandlerOpts: RouteShorthandOptions = {
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

export async function NearTestnetHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const resource = new NearHealthResource();
        const fullHealthData = await resource.fetch();

        if (!fullHealthData || !fullHealthData.testnet) {
            reply.status(400);
            return { error: 'No testnet health data available' };
        }

        // Extract only the testnet data
        const testnetData = {
            network: 'testnet',
            ...fullHealthData.testnet,
            lastUpdated: fullHealthData.lastUpdated
        };

        // Set appropriate HTTP status based on health
        if (testnetData.overallStatus !== 'healthy') {
            reply.status(408);
        }

        reply.header('Content-Type', 'application/json');
        return JSONStringify(testnetData);
    } catch (error) {
        logger.error('Error in NearTestnetHealthHandler:', error);
        reply.status(400);
        return { error: 'Failed to fetch NEAR testnet health data' };
    }
} 