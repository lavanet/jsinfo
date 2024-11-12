
// src/query/handlers/providerHandler.ts

// curl http://localhost:8081/provider/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock, QueryCheckJsinfoDbInstance } from '../../queryDb';
import { GetAndValidateProviderAddressFromRequest } from '../../utils/queryRequestArgParser';
import { MonikerCache } from '../../classes/QueryProviderMonikerCache';

export const ProviderPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: {
                        type: 'number'
                    },
                    datetime: {
                        type: 'number'
                    },
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

export async function ProviderPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    const addr = await GetAndValidateProviderAddressFromRequest("provider", request, reply);
    if (addr === '') {
        return null;
    }

    await QueryCheckJsinfoDbInstance();

    const { latestHeight, latestDatetime } = await GetLatestBlock();

    return {
        height: latestHeight,
        datetime: latestDatetime,
        provider: addr,
        moniker: MonikerCache.GetMonikerForProvider(addr),
        monikerfull: MonikerCache.GetMonikerFullDescription(addr),
    }
}
