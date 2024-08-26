
// src/query/handlers/providerAccountInfoHandler.ts

// curl "http://localhost:8081/providerAccountInfo/lava@1vfpuqq06426z3x4qsn38w6hdqrywqxlc6wmnxp?idx=0"

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { desc, eq, gte, and } from "drizzle-orm";
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { RedisCache } from '../../classes/RedisCache';
import { IsMeaningfulText, JSONStringify, JSONStringifySpaced, logger } from '../../../utils/utils';
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';

type ReportEntry = {
    id: number;
    timestamp: Date;
    provider: string | null;
    data: string | null;
};

export const ProviderAccountInfoRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            id: { type: 'number' },
                            timestamp: { type: 'string' },
                            provider: { type: ['string', 'null'] },
                            data: { type: ['string', 'null'] }
                        }
                    },
                    id: { type: 'number' },
                    timestamp: { type: 'string' },
                    itemCount: { type: 'number' },
                    idx: { type: 'number' }
                },
                required: ['data', 'id', 'timestamp', 'itemCount', 'idx']
            }
        }
    }
};


function removeKey(data: any, key: string): any {
    if (data instanceof Object && !Array.isArray(data)) {
        const newData = {};
        for (const [k, v] of Object.entries(data)) {
            if (k !== key) {
                newData[k] = removeKey(v, key);
            }
        }
        return newData;
    } else if (Array.isArray(data)) {
        return data.map(item => removeKey(item, key));
    } else {
        return data;
    }
}

function stringifyWithSortedKeys(data: any): string {
    const sortedObject = Object.keys(data).sort().reduce((result, key) => {
        result[key] = data[key] instanceof Object ? stringifyWithSortedKeys(data[key]) : data[key];
        return result;
    }, {});
    return JSONStringify(sortedObject);
}

function removeKeyAndStringifyWithSortedKeys(data: string, keyToRemove: string): string {
    const parsedData = JSON.parse(data);
    const cleanedData = removeKey(parsedData, keyToRemove);
    return stringifyWithSortedKeys(cleanedData);
}

async function fetchAllData(addr: string): Promise<ReportEntry[]> {
    await QueryCheckJsinfoReadDbInstance();

    let thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let reportsRes: ReportEntry[] = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providerAccountInfo)
        .where(
            and(
                eq(JsinfoSchema.providerAccountInfo.provider, addr),
                gte(JsinfoSchema.providerAccountInfo.timestamp, thirtyDaysAgo)
            )
        )
        .orderBy(desc(JsinfoSchema.providerAccountInfo.id))
        .offset(0)
        .limit(20);

    // remove here keys that match:
    //     if isinstance(data, (dict, list)):
    // data = remove_key(data, 'block_report')
    // data = json.dumps(data, sort_keys = True)

    const finalRes: ReportEntry[] = [];
    const uniqueTimestamps = new Set<string>();
    const uniqueConts = new Set<string>();

    reportsRes.forEach((report: ReportEntry) => {
        if (!report.data || !IsMeaningfulText(report.data)) return;

        try {
            let x = JSON.parse(report.data);
        } catch (error) {
            return;
        }

        const cont = removeKeyAndStringifyWithSortedKeys(report.data, 'block_report');
        if (uniqueConts.has(cont)) return;

        const timestampKey = report.timestamp.toString();
        if (uniqueTimestamps.has(timestampKey)) return;

        uniqueTimestamps.add(timestampKey);
        uniqueConts.add(cont);
        finalRes.push(report);
    });

    return finalRes;
}

async function getAllData(addr: string): Promise<ReportEntry[]> {
    const val = await RedisCache.get("ProviderAccountInfoRawHandler-" + addr);
    if (val) {
        try {
            return JSON.parse(val);
        } catch (e) {
            logger.error("Error parsing JSON from Redis cache", e);
        }
    }
    const data = await fetchAllData(addr);
    await RedisCache.set("ProviderAccountInfoRawHandler-" + addr, JSONStringify(data), 10 * 60); // Ensure data is stringified before storing
    return data;
}

export async function ProviderAccountInfoRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest("providerAccountInfo", request, reply);
    if (addr === '') {
        return reply;
    }

    const data: ReportEntry[] = await getAllData(addr);

    // Check if 'idx' query parameter is provided and is a valid number
    const idx = parseInt((request.query as any).idx, 10);
    if (!isNaN(idx) && idx >= 0 && idx < data.length) {
        // Return the specific item at index 'idx' along with item count and item id
        const item = data[idx];
        return {
            data: item,
            id: item.id,
            timestamp: item.timestamp,
            itemCount: data.length,
            idx: idx
        };
    }

    if (idx == 0 && data.length == 0) {
        return {
            data: "empty",
            id: "",
            timestamp: 0,
            itemCount: 0,
            idx: 0
        };
    }

    WriteErrorToFastifyReply(reply, "Invalid 'idx' query parameter. Please provide a valid index: " + JSONStringifySpaced(request.query));
    return reply;
}
