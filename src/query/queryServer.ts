// ./src/query/server.ts

import Fastify, { FastifyBaseLogger, FastifyInstance, RouteShorthandOptions, FastifyRequest, FastifyReply } from 'fastify'
import fastifyCors from '@fastify/cors';

import pino from 'pino';

import { JSINFO_QUERY_HIGH_POST_BODY_LIMIT, JSINFO_QUERY_FASITY_PRINT_LOGS } from './queryConsts';
import { AddErrorResponseToFastifyServerOpts, ItemCountOpts, WriteErrorToFastifyReply } from './utils/queryServerUtils';
import { validatePaginationString } from './utils/queryPagination';

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
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
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
        if (isValidData(handlerData)) {
            reply.send(handlerData);
            return reply;
        }

        reply.send({});
        return reply;
    };
}

function isValidData(data: any): boolean {
    return typeof data === 'object' && data !== null;
}

export function RegistePaginationServerHandler(
    path: string,
    opts: RouteShorthandOptions,
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>,
    ItemCountRawHandler?: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
    console.log("Registering handlerfor path: " + path);
    opts = AddErrorResponseToFastifyServerOpts(opts);
    server.get(path, opts, handleRequestWithPagination(handler));

    if (ItemCountRawHandler) {
        console.log("Registering ItemCountRawHandler for path: " + "/item-count" + path);
        server.get("/item-count" + path, ItemCountOpts, ItemCountRawHandler);
    }
}

export function GetServerInstance() {
    return server;
}