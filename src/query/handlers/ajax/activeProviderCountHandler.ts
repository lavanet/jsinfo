import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';

export const ActiveProviderCountHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    activeProviderCount: { type: 'number' }
                }
            }
        }
    }
};

export async function ActiveProviderCountHandler(_: FastifyRequest, _reply: FastifyReply) {
    const activeProviders = await ActiveProvidersService.fetch();
    return { activeProviderCount: activeProviders?.length || 0 };
}