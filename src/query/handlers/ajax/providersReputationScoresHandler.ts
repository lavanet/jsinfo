import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProvidersReputationScoresService } from '@jsinfo/redis/resources/ProviderConsumerOptimizerMetrics/ProvidersReputationScores';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const ProvidersReputationScoresHandlerOpts: RouteShorthandOptions = {
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

export async function ProvidersReputationScoresHandler(request: FastifyRequest, reply: FastifyReply) {
    const scores = await ProvidersReputationScoresService.fetch();

    if (!scores || scores.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch provider reputation scores' });
    }

    reply.header('Content-Type', 'application/json');
    return JSONStringify(scores);
}
