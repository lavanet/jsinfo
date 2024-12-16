import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { TotalValueLockedItem, TotalValueLockedResource } from '@jsinfo/redis/resources/ajax/TotalValueLockedResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';

export const TotalValueLockedComponentsHandlerOpts: RouteShorthandOptions = {
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

export async function TotalValueLockedComponentsHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new TotalValueLockedResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const total: TotalValueLockedItem = {
        key: 'Misc_Total',
        ulavaValue: totalValueLockedItems.reduce((sum, item) => sum + item.ulavaValue, 0),
        USDValue: totalValueLockedItems.reduce((sum, item) => sum + item.USDValue, 0)
    };

    const coinGeckoRate: TotalValueLockedItem = {
        key: 'Misc_CoinGecko-LavaNetwork-Rate',
        ulavaValue: 1000000,
        USDValue: await CoinGekoCache.GetLavaUSDRate()
    };

    totalValueLockedItems.push(total);
    totalValueLockedItems.push(coinGeckoRate);
    reply.header('Content-Type', 'application/json');
    return JSONStringify(totalValueLockedItems);
}


