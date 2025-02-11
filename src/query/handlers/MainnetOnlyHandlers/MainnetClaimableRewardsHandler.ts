import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ProviderClaimableRewardsService } from '@jsinfo/redis/resources/Mainnet/ProviderClaimableRewards/MainnetProviderClaimableRewardsResource';

export const MainnetClaimableRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                additionalProperties: true,
                type: 'object'
            }
        }
    }
}

export async function MainnetClaimableRewardsHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    try {
        return await ProviderClaimableRewardsService.fetch();
    } catch (error) {
        console.error('Failed to fetch all provider claimable rewards:', error);
        return null;
    }
} 