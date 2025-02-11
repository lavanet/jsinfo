// src/query/handlers/provider/providerCardsDelegatorRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { ProviderClaimableRewardsService } from '@jsinfo/redis/resources/Mainnet/ProviderClaimableRewards/MainnetProviderClaimableRewardsResource';
import { logger } from '@jsinfo/utils/logger';

export const ProviderCardsDelegatorRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                additionalProperties: true,
                type: 'object'
            }
        }
    }
}

export async function ProviderCardsDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply): Promise<any> {
    const addr = await GetAndValidateProviderAddressFromRequest("ProviderCardsDelegatorRewards", request, reply);
    if (addr === '') {
        return null;
    }

    try {
        const allRewards = await ProviderClaimableRewardsService.fetch();
        if (!allRewards || !allRewards.providers) {
            logger.warn('No rewards data available');
            return null;
        }

        const providerData = allRewards.providers[addr];
        if (!providerData || !providerData.rewards) {
            logger.info(`No rewards found for provider ${addr}`);
            return {
                delegator: addr,
                data: {
                    rewards: [],
                    fmtversion: 'v20240407'
                },
                timestamp: new Date().toISOString()
            };
        }

        return {
            delegator: addr,
            data: {
                rewards: providerData.rewards,
                fmtversion: 'v20240407'
            },
            timestamp: providerData.timestamp
        };
    } catch (error) {
        logger.error('Failed to fetch provider claimable rewards:', {
            provider: addr,
            error
        });
        return null;
    }
}