import { FastifyRequest, FastifyReply, RouteShorthandOptions, RouteGenericInterface } from 'fastify';
import { MainnetProviderEstimatedRewards, ProviderRewardsQueryType } from '@jsinfo/redis/resources/MainnetProviderEstimatedRewards/MainnetProviderEstimatedRewardsResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

interface QueryParams {
    type?: ProviderRewardsQueryType;
    block?: string;
}

interface RouteGeneric extends RouteGenericInterface {
    Querystring: QueryParams;
}

export const MainnetProviderEstimatedRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        querystring: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['latest', 'historical', 'blocks']
                },
                block: {
                    type: 'string',
                    pattern: '^[0-9]+$'
                }
            }
        },
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

export async function MainnetProviderEstimatedRewardsHandler(
    request: FastifyRequest<RouteGeneric>,
    reply: FastifyReply
) {
    try {
        const { type = 'latest', block } = request.query;

        const queryParams = {
            type,
            ...(block ? { block: parseInt(block) } : {})
        };

        const response = await MainnetProviderEstimatedRewards.fetch(queryParams);

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(response));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
            error: 'Failed to fetch provider estimated rewards',
            details: errorMessage
        });
    }
}
