// jsinfo/src/query.ts

// TODOs:
// 2. Pagination
require('dotenv').config();

import { logger } from './utils';
import { InitDbInstance, GetLatestBlock } from './query/dbUtils';
import { RegisterServerHandlerWithCache, GetServerInstance } from './query/server';
import { JSINFO_QUERY_HOST, JSINFO_QUERY_PORT, JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED } from './query/consts';

import { IndexHandler, IndexHandlerOpts } from './query/handlers/indexHandler';
import { ProvidersHandler, ProvidersHandlerOpts } from './query/handlers/providersHandler';
import { ProviderHandler, ProviderHandlerOpts } from './query/handlers/providerHandler';
import { SpecsHandler, SpecsHandlerOpts } from './query/handlers/specsHandler';
import { SpecHandler, SpecHandlerOpts } from './query/handlers/specHandler';
import { ConsumersHandler, ConsumersHandlerOpts } from './query/handlers/consumersHandler';
import { ConsumerHandler, ConsumerHandlerOpts } from './query/handlers/consumerHandler';
import { EventsHandler, EventsHandlerOpts } from './query/handlers/eventsHandler';
import { ProviderHealthHandler, ProviderHealthHandlerOpts } from './query/handlers/providerHealthHandler';

import { LatestHandler, LatestHandlerOpts } from './query/handlers/latestHandler';
import { LavapProviderHealthHandler, LavapProviderHealthHandlerOpts } from './query/handlers/lavapProviderHealthHandler';

RegisterServerHandlerWithCache('/index', IndexHandlerOpts, IndexHandler);
RegisterServerHandlerWithCache('/provider/:addr', ProviderHandlerOpts, ProviderHandler);
RegisterServerHandlerWithCache('/providers', ProvidersHandlerOpts, ProvidersHandler);
RegisterServerHandlerWithCache('/specs', SpecsHandlerOpts, SpecsHandler);
RegisterServerHandlerWithCache('/consumers', ConsumersHandlerOpts, ConsumersHandler);
RegisterServerHandlerWithCache('/consumer/:addr', ConsumerHandlerOpts, ConsumerHandler);
RegisterServerHandlerWithCache('/spec/:specId', SpecHandlerOpts, SpecHandler);
RegisterServerHandlerWithCache('/events', EventsHandlerOpts, EventsHandler);
RegisterServerHandlerWithCache('/providerHealth/:addr', ProviderHealthHandlerOpts, ProviderHealthHandler);

GetServerInstance().get('/latest', LatestHandlerOpts, LatestHandler);

if (JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapProviderHealth', LavapProviderHealthHandlerOpts, LavapProviderHealthHandler);
}

export const queryServerMain = async (): Promise<void> => {
    logger.info('Starting query server')

    await InitDbInstance()

    try {
        try {
            const { latestHeight, latestDatetime } = await GetLatestBlock()
            logger.info(`block ${latestHeight} block time ${latestDatetime}`)
        } catch (err) {
            logger.error('failed to connect get block from db')
            logger.error(String(err))
            logger.error('Sleeping one second before exit')
            await new Promise(resolve => setTimeout(resolve, 1000));
            process.exit(1)
        }

        logger.info(`listening on ${JSINFO_QUERY_PORT} ${JSINFO_QUERY_HOST}`)
        await GetServerInstance().listen({ port: JSINFO_QUERY_PORT, host: JSINFO_QUERY_HOST })
    } catch (err) {
        logger.error(String(err))
        logger.error('Sleeping one second before exit')
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(1)
    }
}


try {
    queryServerMain();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the queryserver:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the queryserver:', error);
    }
}
