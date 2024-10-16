// src/query/handlers/specProviderHealthHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { eq, and, gte, desc } from "drizzle-orm";
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { GetAndValidateProviderAddressFromRequest, GetAndValidateSpecIdFromRequest } from '../../utils/queryRequestArgParser';
import { WriteErrorToFastifyReplyNoLog } from '../../utils/queryServerUtils';

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

// SELECT DISTINCT ON(provider, spec, interface) *
//     FROM provider_health
// WHERE provider = 'lava@1lamrmq78w6dnw5ahpyflus5ps7pvlwrtn9rf83'
// AND spec = 'NEAR'
// AND timestamp >= '2024-08-24'
// ORDER BY provider, spec, interface, timestamp DESC
// LIMIT 1000

export async function SpecProviderHealthHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: { healthy: number; unhealthy: number } } | null> {

    let provider = await GetAndValidateProviderAddressFromRequest("specProviderHealth", request, reply);
    if (provider === '') {
        return reply;
    }

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const healthRecords: HealthRecord[] = await QueryGetJsinfoReadDbInstance()
        .selectDistinctOn([JsinfoSchema.providerHealth.provider, JsinfoSchema.providerHealth.spec, JsinfoSchema.providerHealth.interface])
        .from(JsinfoSchema.providerHealth)
        .orderBy(JsinfoSchema.providerHealth.provider, JsinfoSchema.providerHealth.spec, JsinfoSchema.providerHealth.interface, JsinfoSchema.providerHealth.provider, JsinfoSchema.providerHealth.spec, desc(JsinfoSchema.providerHealth.timestamp))
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
        WriteErrorToFastifyReplyNoLog(reply, 'No recent health records for provider');
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