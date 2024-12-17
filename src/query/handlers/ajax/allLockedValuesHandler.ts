import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { LockedTokenValuesItem, LockedTokenValuesResource } from '@jsinfo/redis/resources/ajax/LockedTokenValuesResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';

export const AllLockedValuesHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string'
                    }
                }
            }
        }
    }
}

export async function AllLockedValuesHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new LockedTokenValuesResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const coinGeckoRate: LockedTokenValuesItem = {
        key: 'Misc_CoinGecko-LavaNetwork-Rate',
        ulavaValue: 1000000,
        USDValue: await CoinGekoCache.GetLavaUSDRate(),
        countForTlv: false
    };

    totalValueLockedItems.push(coinGeckoRate);
    reply.header('Content-Type', 'application/json');
    return JSONStringify(totalValueLockedItems);
}


