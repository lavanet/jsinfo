// src/query/handlers/indexChartsV3Handler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { IndexChartsResource } from '../../../redis/resources/index/IndexChartsResource';

export interface IndexChartsQuerystring {
    f?: string;
    t?: string;
}

export const IndexChartsV3RawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                qos: { type: 'number' },
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            chainId: { type: 'string' },
                                            cuSum: { type: 'number' },
                                            relaySum: { type: 'number' },
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

export async function IndexChartsV3RawHandler(request: FastifyRequest<{ Querystring: IndexChartsQuerystring }>, reply: FastifyReply) {
    const { f, t } = request.query;

    const from = f ? new Date(f) : new Date();
    const to = t ? new Date(t) : new Date();

    const resource = new IndexChartsResource();
    const result = await resource.fetchAndPickDb({ from, to });

    return reply.send({ data: result });
}