// src/query/handlers/ajax/chainWalletApiHandlers.ts
// curl http://localhost:8081/lava_chain_stakers
// curl http://localhost:8081/lava_chain_restakers

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import { keyValueStore } from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../utils/utils';

export const ChainWalletApiHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    total: { type: 'string' },
                    monthly: { type: 'string' }
                }
            }
        }
    }
}

async function getKeyValueFromStore(key: string): Promise<string> {
    await QueryCheckJsinfoDbInstance();

    const result = await QueryGetJsinfoDbForQueryInstance()
        .select({ value: keyValueStore.value })
        .from(keyValueStore)
        .where(eq(keyValueStore.key, key));

    if (result.length > 0 && result[0].value) {
        return result[0].value;
    } else {
        logger.warn(`No value found for key: ${key}`);
        return "0";
    }
}

export async function LavaChainStakersHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const total = await getKeyValueFromStore('stakers_current_unique_delegators');
        const monthly = await getKeyValueFromStore('stakers_monthly_unique_delegators');

        return {
            total,
            monthly
        };
    } catch (error) {
        logger.error('Error in LavaChainStakersHandler', { error });
        reply.status(500).send({ error: 'Internal Server Error' });
    }
}

export async function LavaChainRestakersHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const total = await getKeyValueFromStore('restakers_current_unique_delegators');
        const monthly = await getKeyValueFromStore('restakers_monthly_unique_delegators');

        return {
            total,
            monthly
        };
    } catch (error) {
        logger.error('Error in LavaChainRestakersHandler', { error });
        reply.status(500).send({ error: 'Internal Server Error' });
    }
}