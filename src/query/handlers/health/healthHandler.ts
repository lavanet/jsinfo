// src/query/handlers/HealthRawHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import fetch from 'node-fetch';
import { QueryCheckJsinfoReadDbInstance } from '../queryDb';
import { JSINFO_QUERY_PORT, JSINFO_QUERY_HOST } from '../queryConsts';

const JSINFO_BASE_URL = `http://${JSINFO_QUERY_HOST}:${JSINFO_QUERY_PORT}`;

export const HealthRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    health: {
                        type: 'string'
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

async function performHealthCheck(url: string): Promise<boolean> {
    try {
        const response = await fetch(url);
        return response.ok;
    } catch (error) {
        console.error(`Health check failed for ${url}:`, error);
        return false;
    }
}

export async function HealthRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance();

    const urls = [
        `${JSINFO_BASE_URL}/supply/total`,
        `${JSINFO_BASE_URL}/supply/circulating`,
        `${JSINFO_BASE_URL}/listProviders`,
        `${JSINFO_BASE_URL}/latest`,
    ];

    for (const url of urls) {
        const isHealthy = await performHealthCheck(url);
        if (!isHealthy) {
            reply.code(400).send({ error: `Health check failed for ${url}` });
            return;
        }
    }

    reply.send({ health: "ok" });
}