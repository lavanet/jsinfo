// src/query/handlers/healthStatusHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock } from '@jsinfo/query/utils/getLatestBlock';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { gt, desc } from "drizzle-orm";
import { GetUtcNow } from '@jsinfo/utils/date';
import { queryJsinfo } from '@jsinfo/utils/db';
import { CheckDatabaseStatus } from '@jsinfo/utils/db';

export const HealthStatusRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    details: {
                        type: 'object',
                        properties: {
                            latestBlock: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            database: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            redis: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            healthRecords: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true }
                        }
                    }
                }
            },
            503: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    details: {
                        type: 'object',
                        properties: {
                            latestBlock: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            database: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            redis: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true },
                            healthRecords: { type: 'object', properties: { status: { type: 'string' }, message: { type: 'string' } }, nullable: true }
                        }
                    }
                }
            }
        }
    }
}

type HealthCheckResponse = {
    status: "ok" | "error";
    message: string;
};

type HealthCheckResults = {
    latestBlock: HealthCheckResponse | null;
    database: HealthCheckResponse | null;
    redis: HealthCheckResponse | null;
    healthRecords: HealthCheckResponse | null;
};

async function IsLatest(): Promise<HealthCheckResponse> {
    try {
        const { latestHeight, latestDatetime } = await GetLatestBlock();
        const currentUtcTime = new Date().getTime();

        if (Math.abs(currentUtcTime - latestDatetime) > 900000) { // 900000 milliseconds = 15 minutes
            console.error("The latest block's datetime is more than 15 minutes away from the current time.");
            return {
                status: "error",
                message: "The latest block's datetime is more than 15 minutes away from the current time."
            };
        }

        return {
            status: "ok",
            message: `Latest height: ${latestHeight}, datetime: ${new Date(latestDatetime).toISOString()}.`
        };
    } catch (error) {
        console.error("Error occurred while checking if the latest block is up-to-date:", error);
        return {
            status: "error",
            message: "Error occurred while checking if the latest block is up-to-date."
        };
    }
}

async function IsDbOK(): Promise<HealthCheckResponse> {
    try {
        const dbStatus = await CheckDatabaseStatus();
        if (!dbStatus.ok) {
            return {
                status: "error",
                message: dbStatus.details
            };
        }

        return {
            status: "ok",
            message: dbStatus.details
        };
    } catch (error) {
        return {
            status: "error",
            message: `Database connection error: ${(error as Error).message}`
        };
    }
}

async function IsRedisOK(): Promise<HealthCheckResponse> {
    try {
        const isRedisOk = RedisCache.IsAlive()
        if (!isRedisOk) {
            return {
                status: "error",
                message: "Redis instance is not OK."
            };
        }

        return {
            status: "ok",
            message: `Redis connection is ok`
        };
    } catch (error) {
        return {
            status: "error",
            message: "Redis connection error"
        };
    }
}

async function IsHealthProbeOK(): Promise<HealthCheckResponse> {
    try {
        const twentyMinutesAgo = new Date(GetUtcNow().getTime() - 20 * 60 * 1000);

        const recentHealthRecords = await queryJsinfo(
            async (db) => await db
                .select()
                .from(JsinfoSchema.providerHealth)
                .where(gt(JsinfoSchema.providerHealth.timestamp, twentyMinutesAgo))
                .orderBy(desc(JsinfoSchema.providerHealth.id))
                .limit(1),
            'HealthStatus_IsHealthProbeOK'
        );

        if (recentHealthRecords.length == 0) {
            return {
                status: "error",
                message: "No recent entries in health table"
            };
        }

        return {
            status: "ok",
            message: `Latest health entry at: ${recentHealthRecords[0].timestamp}`
        };
    } catch (error) {
        return {
            status: "error",
            message: "Unable to fetch health records"
        };
    }
}

async function CheckSystemHealth(): Promise<HealthCheckResults> {
    const results: HealthCheckResults = {
        latestBlock: null,
        database: null,
        redis: null,
        healthRecords: null
    };

    results.latestBlock = await IsLatest();
    results.database = await IsDbOK();
    results.redis = await IsRedisOK();
    results.healthRecords = await IsHealthProbeOK();

    return results;
}

export async function HealthStatusRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const healthResults = await CheckSystemHealth();
    const overallStatus = Object.values(healthResults).every(result => result && result.status === "ok") ? "ok" : "unhealthy";

    if (overallStatus !== "ok") {
        reply.code(503).send({ status: "unhealthy", details: healthResults });
    } else {
        reply.send({ status: "ok", details: healthResults });
    }
}