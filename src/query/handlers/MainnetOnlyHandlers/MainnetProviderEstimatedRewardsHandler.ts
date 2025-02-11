import { FastifyRequest, FastifyReply, RouteShorthandOptions, RouteGenericInterface } from 'fastify';
import { MainnetProviderEstimatedRewardsGetService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsGetResource';
import { MainnetProviderEstimatedRewardsListService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsListResource';
import { MainnetProviderEstimatedRewardsSpecFilterService } from '@jsinfo/redis/resources/Mainnet/ProviderEstimatedRewards/MainnetProviderEstimatedRewardsSpecFilterResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

interface QueryParams {
    type?: 'list' | 'get' | 'spec';
    block?: string;
    spec?: string;
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
                    enum: ['list', 'get', 'spec']
                },
                block: {
                    type: 'string',
                    pattern: '^(latest|[0-9]+)$'
                },
                spec: {
                    type: 'string'
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
        const { type = 'list', block = 'latest', spec } = request.query;

        switch (type) {
            case 'list':
                const listResponse = await MainnetProviderEstimatedRewardsListService.fetch();
                reply.header('Content-Type', 'application/json');
                return reply.send(JSONStringify(listResponse));

            case 'get':
                const getResponse = await MainnetProviderEstimatedRewardsGetService.fetch({ block });
                reply.header('Content-Type', 'application/json');
                return reply.send(JSONStringify(getResponse));

            case 'spec':
                if (!spec) {
                    return reply.status(400).send({ error: 'Spec parameter is required for spec type' });
                }
                const specResponse = await MainnetProviderEstimatedRewardsSpecFilterService.fetch({ spec, block });
                reply.header('Content-Type', 'application/json');
                return reply.send(JSONStringify(specResponse));

            default:
                return reply.status(400).send({ error: 'Invalid type parameter' });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
            error: 'Failed to fetch provider estimated rewards',
            details: errorMessage
        });
    }
}

export default {
    MainnetProviderEstimatedRewardsHandler,
    MainnetProviderEstimatedRewardsHandlerOpts
};
