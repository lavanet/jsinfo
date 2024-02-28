// ./src/query/server.ts

import Fastify, { FastifyBaseLogger, FastifyInstance, RouteShorthandOptions, FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors';

import pino from 'pino';
import RequestCache from './cache';

import { JSINFO_QUERY_HIGH_POST_BODY_LIMIT } from './consts';

const requestCache: RequestCache = new RequestCache();

const FastifyLogger: FastifyBaseLogger = pino({
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
        }
    }
});

const server: FastifyInstance = Fastify({
    logger: FastifyLogger,
    bodyLimit: JSINFO_QUERY_HIGH_POST_BODY_LIMIT ? 10 * 1024 * 1024 : undefined // 10 MB
});

server.register(fastifyCors, { origin: "*" });

export function AddErrorResponseToFastifyServerOpts(consumerOpts: RouteShorthandOptions): RouteShorthandOptions {
    const schema = consumerOpts.schema || {};
    const response = schema.response || {};

    return {
        ...consumerOpts,
        schema: {
            ...schema,
            response: {
                ...response,
                400: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
            },
        },
    };
}

export function RegisterServerHandlerWithCache(path: string, opts: RouteShorthandOptions, handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>) {
    server.get("/last-updated" + path, async (request: FastifyRequest, reply: FastifyReply) => {
        await requestCache.handleGetDataLastUpdatedDate(request, reply)
    });
    server.get(path, AddErrorResponseToFastifyServerOpts(opts), requestCache.handleRequestWithCache(handler));
}

export function GetServerInstance() {
    return server;
}