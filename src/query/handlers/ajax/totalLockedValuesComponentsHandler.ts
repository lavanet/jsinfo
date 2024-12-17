import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { LockedTokenValuesItem, LockedTokenValuesResource } from '@jsinfo/redis/resources/ajax/LockedTokenValuesResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';

export const TotalLockedValuesComponentsHandlerOpts: RouteShorthandOptions = {
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

type LockedValueItemWithoutCountBool = Omit<LockedTokenValuesItem, 'countForTlv'>;

export async function TotalLockedValuesComponentsHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new LockedTokenValuesResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    const filteredItems: LockedValueItemWithoutCountBool[] = totalValueLockedItems
        .filter(item => item.countForTlv)
        .map(({ countForTlv, ...rest }) => rest);

    const total: LockedValueItemWithoutCountBool = {
        key: 'Misc_Total',
        ulavaValue: filteredItems
            .reduce((sum, item) => sum + item.ulavaValue, 0),
        USDValue: filteredItems
            .reduce((sum, item) => sum + item.USDValue, 0),
    };

    filteredItems.push(total as LockedTokenValuesItem);

    const coinGeckoRate: LockedValueItemWithoutCountBool = {
        key: 'Misc_CoinGecko-LavaNetwork-Rate',
        ulavaValue: 1000000,
        USDValue: await CoinGekoCache.GetLavaUSDRate(),
    };

    filteredItems.push(coinGeckoRate as LockedTokenValuesItem);
    reply.header('Content-Type', 'application/json');
    return JSONStringify(filteredItems);
}


