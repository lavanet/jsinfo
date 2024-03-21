// ./src/query/server.ts

import Fastify, { FastifyBaseLogger, FastifyInstance, RouteShorthandOptions, FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors';

import pino from 'pino';
import RequestCache from './queryCache';

import { JSINFO_QUERY_HIGH_POST_BODY_LIMIT, JSINFO_QUERY_FASITY_PRINT_LOGS } from './queryConsts';

const requestCache: RequestCache = new RequestCache();

const FastifyLogger: FastifyBaseLogger = pino({
    level: 'warn',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
        }
    }
});

const server: FastifyInstance = Fastify({
    logger: JSINFO_QUERY_FASITY_PRINT_LOGS ? FastifyLogger : false,
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

export function AddItemCountResponseToFastifyServerOpts(consumerOpts: RouteShorthandOptions): RouteShorthandOptions {
    const schema = consumerOpts.schema || {};
    const response = schema.response || {};
    const existing200Response = response[200] || {};

    return {
        ...consumerOpts,
        schema: {
            ...schema,
            response: {
                ...response,
                200: {
                    anyOf: [
                        existing200Response,
                        {
                            type: 'object',
                            properties: {
                                itemCount: { type: 'number' },
                            },
                        },
                    ],
                },
            },
        },
    };
}

const itemCountOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    itemCount: { type: 'number' },
                },
            },
        },
    },
};

export function RegisterServerHandlerWithCache(
    path: string,
    opts: RouteShorthandOptions,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
    itemCountHandler?: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
    console.log("Registering last-updated for path: " + "/last-updated" + path);
    server.get("/last-updated" + path, async (request: FastifyRequest, reply: FastifyReply) => {
        await requestCache.handleGetDataLastUpdatedDate(request, reply)
    });

    console.log("Registering handlerfor path: " + path);
    opts = AddErrorResponseToFastifyServerOpts(opts);
    server.get(path, opts, requestCache.handleRequestWithCache(handler));

    if (itemCountHandler) {
        console.log("Registering itemCountHandler for path: " + "/item-count" + path);
        server.get("/item-count" + path, itemCountOpts, itemCountHandler);
    }
}

export function GetServerInstance() {
    return server;
}