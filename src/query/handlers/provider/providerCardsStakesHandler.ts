// src/query/handlers/provider/providerCardsStakesHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { ProviderStakesAndDelegationResource } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';
import { logger } from '@jsinfo/utils/logger';

export const ProviderCardsStakesHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    stakeSum: { type: 'string' },
                    stake: { type: 'string' },
                    delegateTotal: { type: 'string' },
                    active: {
                        stakeSum: { type: 'string' },
                        stake: { type: 'string' },
                        delegateTotal: { type: 'string' },
                    }
                }
            }
        }
    }
}

export async function ProviderCardsStakesHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("providerCardsStakes", request, reply);
    if (addr === '') {
        return null;
    }

    try {
        const resource = new ProviderStakesAndDelegationResource();
        const result = await resource.fetch();
        if (!result) {
            logger.warn(`Failed to fetch stakes data for provider ${addr}`);
            reply.status(400);
            reply.send({ error: 'Failed to fetch stakes data' });
            return reply;
        }

        // First, get the provider's overall stake info
        const providerStake = result.providerStakes[addr];
        if (!providerStake) {
            logger.warn(`Provider stake not found for address: ${addr}`);
            reply.status(404);
            reply.send({ error: 'Provider stake not found' });
            return reply;
        }

        // Calculate total stake values (all stakes)
        const stake = providerStake.stake ? BigInt(providerStake.stake) : BigInt(0);
        const delegateTotal = providerStake.delegateTotal ? BigInt(providerStake.delegateTotal) : BigInt(0);
        const stakeSum = stake + delegateTotal;

        // Now get the provider's individual stake records to filter by status
        let activeStakeSum = BigInt(0);
        let activeDelegateTotal = BigInt(0);
        let activeStake = BigInt(0);

        // Try to get individual stakes to calculate active-only values
        try {
            if (result.detailedProviderStakes && result.detailedProviderStakes[addr]) {
                const stakes = result.detailedProviderStakes[addr];

                // Loop through all specs for this provider
                for (const stake of stakes) {
                    // Only include active stakes
                    if (stake.statusString === 'Active') {
                        activeStake += BigInt(stake.stake || '0');
                        activeDelegateTotal += BigInt(stake.delegateTotal || '0');
                    }
                }
                activeStakeSum = activeStake + activeDelegateTotal;
            } else {
                // If detailed provider stakes are not available, try to use the summary data
                if (result.summary && result.summary.activeCombinedSum) {
                    activeStakeSum = BigInt(result.summary.activeCombinedSum);
                    // Estimate active stake and delegate total proportionally
                    const totalRatio = stakeSum > 0n ? activeStakeSum * 100n / stakeSum : 0n;
                    activeStake = stake * totalRatio / 100n;
                    activeDelegateTotal = delegateTotal * totalRatio / 100n;
                } else {
                    // Fallback to total values
                    activeStake = stake;
                    activeDelegateTotal = delegateTotal;
                    activeStakeSum = stakeSum;
                }
            }
        } catch (error) {
            logger.warn(`Error calculating active stakes: ${error}. Using total values.`);
            // Fall back to total values if we can't calculate active-only
            activeStake = stake;
            activeDelegateTotal = delegateTotal;
            activeStakeSum = stakeSum;
        }

        // Return both total and active-only values
        return {
            stakeSum: stakeSum.toString(),
            stake: stake.toString(),
            delegateTotal: delegateTotal.toString(),
            active: {
                stakeSum: activeStakeSum.toString(),
                stake: activeStake.toString(),
                delegateTotal: activeDelegateTotal.toString()
            }
        };
    } catch (error) {
        logger.error(`Error in ProviderCardsStakesHandler for ${addr}: ${error}`);
        reply.status(400);
        reply.send({ error: 'Internal server error processing provider stakes' });
        return reply;
    }
}