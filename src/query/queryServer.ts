// ./src/query/server.ts

import Fastify, { FastifyBaseLogger, FastifyInstance, RouteShorthandOptions, FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors';
import pino from 'pino';
import { JSINFO_QUERY_HIGH_POST_BODY_LIMIT, JSINFO_QUERY_FASITY_PRINT_LOGS } from './queryConsts';
import { AddErrorResponseToFastifyServerOpts, ItemCountOpts, WriteErrorToFastifyReply } from './utils/queryServerUtils';
import { validatePaginationString } from './utils/queryPagination';
import { RedisCache } from './classes/RedisCache';

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

function handleRequestWithPagination(
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
): (request: FastifyRequest, reply: FastifyReply) => Promise<any> {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as { [key: string]: unknown };

        if (query.pagination && typeof query.pagination === 'string') {
            if (!validatePaginationString(query.pagination)) {
                console.log('Failed to parse pagination:', query.pagination);
                WriteErrorToFastifyReply(reply, 'Bad pagination argument');
                return reply;
            }
        }

        const handlerData = await handler(request, reply);
        // returns null on error and handler handled the response
        if (handlerData == null) return reply;

        reply.send(handlerData);
        return reply;
    };
}

export function RegisterPaginationServerHandler(
    path: string,
    opts: RouteShorthandOptions,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
    ItemCountPaginatiedHandler?: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
    console.log("Registering paginated handler for path: " + path);
    opts = AddErrorResponseToFastifyServerOpts(opts);
    server.get(path, opts, handleRequestWithPagination(handler));

    if (ItemCountPaginatiedHandler) {
        console.log("Registering item count handler for path: " + "/item-count" + path);
        server.get("/item-count" + path, ItemCountOpts, ItemCountPaginatiedHandler);
    }
}

function handleRequestWithRedisCache(
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
    cache_ttl?: number | null,
): (request: FastifyRequest, reply: FastifyReply) => Promise<any> {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const cacheKey = `url:${request.url.split('?')[0].substring(1)}`; // Use the path and query for the cache key

        const cachedResponse = await RedisCache.get(cacheKey);
        if (cachedResponse) {
            const parsedResponse = JSON.parse(cachedResponse);
            reply.send(parsedResponse);
            return reply;
        }

        // If no cache is found, call the handler
        const handlerData = await handler(request, reply);
        // returns null on error and handler handled the response
        if (handlerData == null) return reply;

        // Cache the new response
        await RedisCache.set(cacheKey, JSON.stringify(handlerData), cache_ttl || 30);

        reply.send(handlerData);
        return reply;
    };
}

export function RegisterRedisBackedHandler(
    path: string,
    opts: RouteShorthandOptions,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
    options: { cache_ttl?: number } = {}
) {
    console.log("Registering reddis handler for path: " + path);
    opts = AddErrorResponseToFastifyServerOpts(opts);
    server.get(path, opts, handleRequestWithRedisCache(handler, options?.cache_ttl));
}

export function GetServerInstance() {
    return server;
}