// src/query/handlers/specProviderHealthHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { eq, and, gte } from "drizzle-orm";
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { GetAndValidateProviderAddressFromRequest, GetAndValidateSpecIdFromRequest } from '../../utils/queryRequestArgParser';
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';

type HealthRecord = {
    id: number;
    provider: string | null;
    data: string | null;
    timestamp: Date;
    guid: string | null;
    spec: string;
    geolocation: string | null;
    interface: string | null;
    status: string;
}

export const SpecProviderHealthHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            healthy: { type: 'number' },
                            unhealthy: { type: 'number' }
                        }
                    }
                }
            }
        }
    }
};

export async function SpecProviderHealthHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: { healthy: number; unhealthy: number } } | null> {

    let provider = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (provider === '') {
        return null;
    }

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return null;
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const healthRecords: HealthRecord[] = await QueryGetJsinfoReadDbInstance()
        .selectDistinctOn([JsinfoSchema.providerHealth.provider, JsinfoSchema.providerHealth.spec, JsinfoSchema.providerHealth.interface])
        .from(JsinfoSchema.providerHealth)
        .where(
            and(
                and(
                    eq(JsinfoSchema.providerHealth.provider, provider),
                    eq(JsinfoSchema.providerHealth.spec, spec)
                ),
                gte(JsinfoSchema.providerHealth.timestamp, twoDaysAgo)
            )
        )
        .limit(1000);

    if (healthRecords.length === 0) {
        WriteErrorToFastifyReply(reply, 'No recent health records for provider');
        return null;
    }

    const healthStatusCounts = { healthy: 0, unhealthy: 0 };

    healthRecords.forEach(({ status }) => {
        if (status === 'healthy') {
            healthStatusCounts.healthy += 1;
        } else {
            healthStatusCounts.unhealthy += 1;
        }
    });

    return { data: healthStatusCounts };
}