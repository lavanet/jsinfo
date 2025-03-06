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
                    },
                    commission: { type: 'string' }
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
        // Initialize stake variables
        let stake = BigInt(0);
        let delegateTotal = BigInt(0);
        let stakeSum = BigInt(0);
        let activeStake = BigInt(0);
        let activeDelegateTotal = BigInt(0);
        let activeStakeSum = BigInt(0);

        // For average commission calculation
        let activeCommissionSum = 0;
        let activeStakeCount = 0;

        const resource = new ProviderStakesAndDelegationResource();
        const result = await resource.fetch();
        if (!result) {
            logger.warn(`Failed to fetch stakes data for provider ${addr}`);
            reply.status(400);
            reply.send({ error: 'Failed to fetch stakes data' });
            return reply;
        }

        // First, check if provider exists
        const providerStake = result.providerStakes[addr];
        if (!providerStake) {
            logger.warn(`Provider stake not found for address: ${addr}`);
            reply.status(404);
            reply.send({ error: 'Provider stake not found' });
            return reply;
        }

        // Process detailed stakes if available
        if (result.detailedProviderStakes && result.detailedProviderStakes[addr]) {
            const stakes = result.detailedProviderStakes[addr];

            // Single pass through stakes to calculate both total and active values
            for (const stakeItem of stakes) {
                const stakeValue = BigInt(stakeItem.stake || '0');
                const delegateTotalValue = BigInt(stakeItem.delegateTotal || '0');

                // Add to total stakes
                stake += stakeValue;
                delegateTotal += delegateTotalValue;

                // Add to active stakes if applicable
                if (stakeItem.statusString === 'Active') {
                    activeStake += stakeValue;
                    activeDelegateTotal += delegateTotalValue;

                    // Track commission for active stakes
                    if (stakeItem.delegateCommission) {
                        // Convert to number for averaging
                        const commission = Number(stakeItem.delegateCommission);
                        if (!isNaN(commission)) {
                            activeCommissionSum += commission;
                            activeStakeCount++;
                        }
                    }
                }
            }

            stakeSum = stake + delegateTotal;
            activeStakeSum = activeStake + activeDelegateTotal;
        } else {
            // Fall back to providerStakes and summary data
            stake = BigInt(providerStake.stake || '0');
            delegateTotal = BigInt(providerStake.delegateTotal || '0');
            stakeSum = stake + delegateTotal;

            // Try to get active values from summary if available
            if (result.summary && result.summary.activeCombinedSum) {
                activeStakeSum = BigInt(result.summary.activeCombinedSum);

                // If we have both summary data and total stake is non-zero,
                // distribute active values proportionally
                if (stakeSum > 0n) {
                    const ratio = activeStakeSum * 100n / stakeSum;
                    activeStake = stake * ratio / 100n;
                    activeDelegateTotal = delegateTotal * ratio / 100n;
                }
            } else {
                // No detailed or summary data, use total values
                activeStake = stake;
                activeDelegateTotal = delegateTotal;
                activeStakeSum = stakeSum;
            }
        }

        // Consistency check: active can't be greater than total
        if (activeStakeSum > stakeSum) {
            logger.warn(`Provider ${addr} has inconsistent data: active (${activeStakeSum}) > total (${stakeSum})`);
            stake = activeStake;
            delegateTotal = activeDelegateTotal;
            stakeSum = activeStakeSum;
        }

        // Calculate average commission
        const avgActiveCommission = activeStakeCount > 0
            ? Math.round((activeCommissionSum / activeStakeCount) * 100) / 100  // Round to 2 decimal places
            : 0;

        // Return formatted response with average commission
        return {
            stakeSum: stakeSum.toString(),
            stake: stake.toString(),
            delegateTotal: delegateTotal.toString(),
            active: {
                stakeSum: activeStakeSum.toString(),
                stake: activeStake.toString(),
                delegateTotal: activeDelegateTotal.toString()
            },
            commission: avgActiveCommission
        };
    } catch (error) {
        logger.error(`Error in ProviderCardsStakesHandler for ${addr}: ${error}`);
        reply.status(400);
        reply.send({ error: 'Internal server error processing provider stakes' });
        return reply;
    }
}