import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { StakersAndRestakersService } from '@jsinfo/redis/resources/ajax/StackersAndRestkersResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

export const StakersAndRestakersHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
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
}

export async function StakersAndRestakersHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        logger.info('Fetching stakers and restakers data');
        const data = await StakersAndRestakersService.fetch();

        if (!data) {
            return reply.status(400).send({ error: 'Failed to fetch stakers and restakers data' });
        }

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(data));
    } catch (error) {
        logger.error('Error in StakersAndRestakersHandler', { error });
        return reply.status(400).send({ error: 'Internal server error' });
    }
} 