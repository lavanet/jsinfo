import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { NearHealthResource } from '@jsinfo/redis/resources/ajax/NearHealthResource';
import { logger } from '@jsinfo/utils/logger';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const NearHealthHandlerOpts: RouteShorthandOptions = {
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
            },
        }
    }
};

export async function NearHealthHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const resource = new NearHealthResource();
        const healthData = await resource.fetch();

        if (!healthData) {
            reply.status(400);
            return { error: 'No health data available' };
        }

        if (healthData.health !== 'healthy') {
            reply.status(408);
        }

        reply.header('Content-Type', 'application/json');
        return JSONStringify(healthData);
    } catch (error) {
        logger.error('Error in NearHealthHandler:', error);
        reply.status(400);
        return { error: 'Failed to fetch NEAR health data' };
    }
} 