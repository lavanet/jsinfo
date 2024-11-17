
// src/query/handlers/providerHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';

export const ProviderV2PaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    provider: {
                        type: 'string'
                    },
                    moniker: {
                        type: 'string'
                    },
                    monikerfull: {
                        type: 'string'
                    },
                }
            }
        }
    }
}

export async function ProviderV2PaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("provider", request, reply);
    if (addr === '') {
        return null;
    }

    return {
        provider: addr,
        moniker: ProviderMonikerService.GetMonikerForProvider(addr),
        monikerfull: ProviderMonikerService.GetMonikerFullDescription(addr),
    }
}
