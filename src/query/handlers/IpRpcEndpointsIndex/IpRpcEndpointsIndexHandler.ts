import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { IpRpcEndpointsIndexService } from '@jsinfo/redis/resources/IpRpcEndpointsIndex/IpRpcEndpointsResource';
import { JSONStringify } from '@jsinfo/utils/fmt';

export const IpRpcEndpointsIndexHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

export async function IpRpcEndpointsIndexHandler(_: FastifyRequest, reply: FastifyReply) {
    try {
        const endpoints = await IpRpcEndpointsIndexService.fetch({});
        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(endpoints));
    } catch (error) {
        return reply.status(500).send({ error: 'Failed to fetch IP RPC endpoints' });
    }
}
