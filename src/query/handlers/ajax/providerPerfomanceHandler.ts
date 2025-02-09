import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProviderPerformanceService } from '@jsinfo/redis/resources/ajax/ProviderPerformanceResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const ProviderPerformanceHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

export async function ProviderPerformanceRawHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const data = await ProviderPerformanceService.fetch({});
        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(data));
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch provider performance data' });
    }
}