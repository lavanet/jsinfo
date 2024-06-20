// src/query/handlers/providerHealthLatestHandler.ts

// curl http://localhost:8081/providerLatestHealth/lava@1vuavgpa0cpufrq60zdggm8rusxann8ys76taf4
// curl http://localhost:8081/providerLatestHealth/lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import { eq, and, gte, desc } from "drizzle-orm";
import { providerHealth } from '../../schemas/jsinfoSchema';
import { GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { WriteErrorToFastifyReply } from '../utils/queryServerUtils';

type ProviderHealthLatestResponse = {
    provider: string;
    specs: {
        [spec: string]: {
            [iface: string]: {
                [geolocation: string]: {
                    status: string;
                    data: any | null;
                    timestamp: string;
                }
            }
        }
    };
    overallStatus: string;
};

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

export const ProviderHealthLatestCachedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            provider: { type: 'string' },
                            specs: {
                                type: 'object',
                                additionalProperties: {
                                    type: 'object',
                                    additionalProperties: {
                                        type: 'object',
                                        additionalProperties: {
                                            type: 'object',
                                            properties: {
                                                status: { type: 'string' },
                                                data: { type: ['object', 'null'], additionalProperties: {} },
                                                timestamp: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            },
                            overallStatus: { type: 'string' }
                        }
                    }
                }
            }
        }
    }
};

export async function ProviderHealthLatestCachedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: ProviderHealthLatestResponse } | null> {
    let provider = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (provider === '') {
        // null is retuned for *CachedHandler function - the first caching layer on the request side
        // reply is returned in the *RawHandler functions - which skip this cache and probably use the CachedDiskDbDataFetcher
        // CachedDiskDbDataFetcher is the layer of caching against the db and not against the query
        return null;
    }

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const healthRecords: HealthRecord[] = await QueryGetJsinfoReadDbInstance()
        .select()
        .from(providerHealth)
        .where(
            and(
                eq(providerHealth.provider, provider),
                gte(providerHealth.timestamp, twoDaysAgo)
            )
        )
        .orderBy(desc(providerHealth.timestamp))
        .limit(1000);

    if (healthRecords.length === 0) {
        WriteErrorToFastifyReply(reply, 'No health records for provider');
        return null;
    }

    const specs: ProviderHealthLatestResponse['specs'] = {};
    let overallStatus = 'healthy';

    for (const record of healthRecords) {
        const { spec, interface: iface, geolocation, status, timestamp, data } = record;

        if (!iface || !geolocation) {
            continue;
        }

        if (!specs[spec]) specs[spec] = {};
        if (!specs[spec][iface]) specs[spec][iface] = {};
        if (!specs[spec][iface][geolocation]) {
            specs[spec][iface][geolocation] = {
                status,
                data: data ? JSON.parse(data) : null,
                timestamp: timestamp.toISOString()
            };
        } else {
            const existingRecord = specs[spec][iface][geolocation];
            if (new Date(existingRecord.timestamp) < timestamp) {
                specs[spec][iface][geolocation] = {
                    status,
                    data: data ? JSON.parse(data) : null,
                    timestamp: timestamp.toISOString()
                };
            }
        }

        if (status !== 'healthy') {
            if (overallStatus == "degraded") {
                overallStatus = 'unhealthy';
            } else {
                overallStatus = (overallStatus === 'healthy') ? 'degraded' : overallStatus;
            }
        }
    }

    return {
        data: {
            provider,
            specs,
            overallStatus
        }
    };
}
