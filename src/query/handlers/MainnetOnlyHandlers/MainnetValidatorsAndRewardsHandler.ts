import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { MainnetValidatorsWithRewardsService } from '@jsinfo/redis/resources/Mainnet/ValidatorWithRewards/MainnetValidatorsWithRewardsResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const MainnetValidatorsAndRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

export async function MainnetValidatorsAndRewardsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const response = await MainnetValidatorsWithRewardsService.fetch();
        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(response));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
            error: 'Failed to fetch validators and rewards data',
            details: errorMessage
        });
    }
}

export default {
    MainnetValidatorsAndRewardsHandler,
    MainnetValidatorsAndRewardsHandlerOpts
};
