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

export async function TotalLockedValuesComponentsHandler(request: FastifyRequest, reply: FastifyReply) {
    const resource = new LockedTokenValuesResource();
    const totalValueLockedItems = await resource.fetch();

    if (!totalValueLockedItems || totalValueLockedItems.length === 0) {
        return reply.status(400).send({ error: 'Failed to fetch Total Value Locked data' });
    }

    // Make a copy of the items to avoid modifying the source data
    const allItems = [...totalValueLockedItems];

    // Calculate the total based only on countForTlv=true items
    const countedItems = totalValueLockedItems.filter(item => item.countForTlv);

    // Create the total item
    const total: LockedTokenValuesItem = {
        key: 'Total_Of_Counted_For_TLV',
        ulavaValue: countedItems.reduce((sum, item) => sum + item.ulavaValue, 0),
        USDValue: countedItems.reduce((sum, item) => sum + item.USDValue, 0),
        countForTlv: true // Mark as counted for TLV
    };

    // Add the total to the list
    allItems.push(total);

    // Add the CoinGecko rate item
    const coinGeckoRate: LockedTokenValuesItem = {
        key: 'Misc_CoinGecko-LavaNetwork-Rate',
        ulavaValue: 1000000,
        USDValue: await CoinGekoCache.GetLavaUSDRate(),
        countForTlv: false // Not counted for TLV
    };

    allItems.push(coinGeckoRate);

    reply.header('Content-Type', 'application/json');
    return JSONStringify(allItems);
}


