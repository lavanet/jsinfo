// src/query/handlers/provider/providerCardsDelegatorRewardsHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';

export const ProviderCardsDelegatorRewardsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    data: {
                        type: 'object',
                        nullable: true,
                        properties: {
                            provider: { type: 'string' },
                            amounts: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        denom: { type: 'string' },
                                        amount: { type: 'string' }
                                    }
                                }
                            },
                            timestamp: { type: 'string', format: 'date-time' }
                        }
                    }
                }
            }
        }
    }
}

async function getDelegatorRewards(addr: string) {
    return await QueryGetJsinfoReadDbInstance()
        .select()
        .from(JsinfoSchema.delegatorRewards)
        .where(eq(JsinfoSchema.delegatorRewards.provider, addr))
        .limit(1);
}

export async function ProviderCardsDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("ProviderCardsDelegatorRewards", request, reply);
    if (addr === '') {
        return;
    }

    await QueryCheckJsinfoReadDbInstance();

    const stakeSum = await getDelegatorRewards(addr);

    return {
        stakeSum: stakeSum.toString()
    };
}