// src/query/handlers/providerHealthLatestHandler.ts

// curl http://localhost:8081/providerLatestHealth/lava@1vuavgpa0cpufrq60zdggm8rusxann8ys76taf4
// curl http://localhost:8081/providerLatestHealth/lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../../queryDb';
import { eq, and, gte, desc } from "drizzle-orm";
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { WriteErrorToFastifyReply, WriteErrorToFastifyReplyNoLog } from '../../utils/queryServerUtils';
import { ParseDateToUtc } from '../../utils/queryDateUtils';
import { logger } from '../../../utils/utils';

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

type ProviderHealthLatestResponse = {
    provider: string;
    specs: Array<{
        spec: string;
        specData: {
            overallStatus: string;
            interfaces: {
                [iface: string]: {
                    [geolocation: string]: {
                        status: string;
                        data: string;
                        timestamp: string;
                    }
                }
            }
        }
    }>;
};

export const ProviderHealthLatestPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        spec: { type: 'string' },
                                        specData: {
                                            type: 'object',
                                            properties: {
                                                overallStatus: { type: 'string' },
                                                interfaces: {
                                                    type: 'object',
                                                    additionalProperties: {
                                                        type: 'object',
                                                        additionalProperties: {
                                                            type: 'object',
                                                            properties: {
                                                                status: { type: 'string' },
                                                                data: { type: 'string' },
                                                                timestamp: { type: 'string' }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

const ParseMessageFromHealthV2 = (data: any | null): string => {
    if (!data) return "";
    try {
        const parsedData = JSON.parse(data);

        if (parsedData.message) {
            return parsedData.message;
        }

        if (parsedData.jail_end_time && parsedData.jails) {
            const date = ParseDateToUtc(parsedData.jail_end_time);
            // bad db data
            const is1970Included = `${parsedData.jail_end_time}${parsedData.jails}${date}`.includes("1970-01-01");
            if (is1970Included) return "";
            let formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
            return `End Time:${formattedDate}, Jails:${parsedData.jails}`;
        }

        if (parsedData.block && parsedData.others) {
            const blockMessage = `Block: 0x${(parsedData.block).toString(16)}`;
            const latestBlock = parsedData.others;
            let finalMessage = `${blockMessage}, Others: 0x${(latestBlock).toString(16)}`;

            if (parsedData.latency) {
                const latencyInMs = parsedData.latency / 1000000;
                finalMessage += `. ${latencyInMs.toFixed(0)}ms`;
            }

            return finalMessage;
        }

        return "";
    } catch (e) {
        logger.error('ParseMessageFromHealthV2 - failed parsing data:', e);
        return "";
    }
}

// null is retuned for *PaginatedHandler functions
// reply is returned in the *RawHandler functions - does not the use the RequestHandlerBase class

export async function ProviderHealthLatestPaginatedHandler(request: FastifyRequest, reply: FastifyReply): Promise<{ data: ProviderHealthLatestResponse } | null> {
    let provider = await GetAndValidateProviderAddressFromRequest("providerHealthLatest", request, reply);
    if (provider === '') {
        return null;
    }


    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const geolocations = ['EU', 'US', 'ASIA'];
    let allHealthRecords: HealthRecord[] = [];

    for (const geolocation of geolocations) {
        const healthRecords: HealthRecord[] = await QueryGetJsinfoReadDbInstance()
            .select()
            .from(JsinfoSchema.providerHealth)
            .where(
                and(
                    eq(JsinfoSchema.providerHealth.provider, provider),
                    eq(JsinfoSchema.providerHealth.geolocation, geolocation),
                    gte(JsinfoSchema.providerHealth.timestamp, twoDaysAgo)
                )
            )
            .orderBy(desc(JsinfoSchema.providerHealth.id))
            .limit(500);

        allHealthRecords.push(...healthRecords);
    }

    if (allHealthRecords.length === 0) {
        WriteErrorToFastifyReplyNoLog(reply, 'No recent health records for provider');
        return null;
    }

    const specsArray: ProviderHealthLatestResponse['specs'] = [];
    const specsData: { [spec: string]: { overallStatus: string; interfaces: { [iface: string]: { [geolocation: string]: { status: string; data: string; timestamp: string; } } } } } = {};
    const healthStatusPerSpec: { [spec: string]: { allHealthy: boolean, allUnhealthy: boolean } } = {};

    for (const record of allHealthRecords) {
        const { spec, interface: iface, geolocation, status, timestamp, data } = record;

        if (!iface || !geolocation) {
            continue;
        }

        if (!specsData[spec]) {
            specsData[spec] = {
                overallStatus: 'healthy',
                interfaces: {
                    [iface]: {}
                }
            };
            healthStatusPerSpec[spec] = { allHealthy: true, allUnhealthy: true };
        }

        let status_updated = false;

        if (!specsData[spec].interfaces[iface]) specsData[spec].interfaces[iface] = {};
        if (!specsData[spec].interfaces[iface][geolocation]) {
            specsData[spec].interfaces[iface][geolocation] = {
                status,
                data: ParseMessageFromHealthV2(data),
                timestamp: timestamp.toISOString()
            };
            status_updated = true;
        } else {
            const existingRecord = specsData[spec].interfaces[iface][geolocation];
            if (new Date(existingRecord.timestamp) < timestamp) {
                specsData[spec].interfaces[iface][geolocation] = {
                    status,
                    data: ParseMessageFromHealthV2(data),
                    timestamp: timestamp.toISOString()
                };
                status_updated = true;
            }
        }

        if (status_updated) {
            if (status !== 'healthy') {
                healthStatusPerSpec[spec].allHealthy = false;
            } else {
                healthStatusPerSpec[spec].allUnhealthy = false;
            }
        }
    }

    for (const spec in specsData) {
        const statuses = Object.values(specsData[spec].interfaces)
            .flatMap(geo => Object.values(geo))
            .map(data => data.status);

        if (statuses.every(status => status === 'healthy')) {
            specsData[spec].overallStatus = 'healthy';
        } else if (statuses.every(status => status === 'unhealthy')) {
            specsData[spec].overallStatus = 'unhealthy';
        } else if (statuses.every(status => status === 'frozen')) {
            specsData[spec].overallStatus = 'frozen';
        } else if (statuses.every(status => status === 'jailed')) {
            specsData[spec].overallStatus = 'jailed';
        } else {
            specsData[spec].overallStatus = 'degraded';
        }
        specsArray.push({ spec, specData: specsData[spec] });
    }

    specsArray.sort((a, b) => a.spec.localeCompare(b.spec));

    return {
        data: {
            provider,
            specs: specsArray
        }
    };
}