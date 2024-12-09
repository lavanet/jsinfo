// src/query/handlers/specProviderHealthHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest, GetAndValidateSpecIdFromRequest } from '../../utils/queryRequestArgParser';
import { WriteErrorToFastifyReplyNoLog } from '../../utils/queryServerUtils';
import { SpecProviderHealthResource } from '@jsinfo/redis/resources/spec/SpecProviderHealthResource';

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

    let provider = await GetAndValidateProviderAddressFromRequest("specProviderHealth", request, reply);
    if (provider === '') {
        return reply;
    }

    let spec = await GetAndValidateSpecIdFromRequest(request, reply);
    if (spec === '') {
        return reply;
    }

    const sphr = new SpecProviderHealthResource();
    const healthRecords = await sphr.fetch({ spec });

    if (!healthRecords || healthRecords.length === 0) {
        WriteErrorToFastifyReplyNoLog(reply, 'No recent health records for spec');
        return null;
    }

    const filteredHealthRecords: HealthRecord[] = [];

    for (const record of healthRecords) {
        if (record.provider === provider) {
            filteredHealthRecords.push(record);
        }
    }

    if (filteredHealthRecords.length === 0) {
        WriteErrorToFastifyReplyNoLog(reply, 'No recent health records for provider');
        return null;
    }

    const healthStatusCounts = { healthy: 0, unhealthy: 0 };

    filteredHealthRecords.forEach(({ status }) => {
        if (status === 'healthy') {
            healthStatusCounts.healthy += 1;
        } else {
            healthStatusCounts.unhealthy += 1;
        }
    });

    return { data: healthStatusCounts };
}