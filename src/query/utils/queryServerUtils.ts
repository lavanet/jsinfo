// ./src/query/server.ts

import { RouteShorthandOptions, FastifyReply } from 'fastify'
import { logger } from '@jsinfo/utils/logger';

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

export const ItemCountOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    itemCount: { type: 'number' },
                },
                required: [],
            },
        },
    },
};

export function WriteErrorToFastifyReply(reply: FastifyReply, message: string) {
    logger.error(`WriteErrorToFastifyReply:: ${message}`);
    reply.code(400).send({ error: message });
}

export function WriteErrorToFastifyReplyNoLog(reply: FastifyReply, message: string) {
    reply.code(400).send({ error: message });
}