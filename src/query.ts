// jsinfo/src/query.ts

require('dotenv').config();

import { logger } from './utils';
import { InitDbInstance, GetLatestBlock, InitReadDbInstance } from './query/queryDb';
import { RegisterServerHandlerWithCache, GetServerInstance } from './query/queryServer';
import * as consts from './query/queryConsts';

import { IndexHandler, IndexHandlerOpts } from './query/handlers/indexHandler';
import { IndexProvidersHandler, IndexProvidersHandlerOpts, IndexProvidersItemCountHandler, IndexProvidersCSVHandler } from './query/handlers/indexProvidersHandler';

import { ProviderHandler, ProviderHandlerOpts } from './query/handlers/providerHandler';
import { ProviderStakesHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountHandler, ProviderStakesCSVHandler } from './query/handlers/providerStakesHandler';
import { ProviderEventsHandlerOpts, ProviderEventsHandler, ProviderEventsItemCountHandler, ProviderEventsCSVHandler } from './query/handlers/providerEventsHandler';
import { ProviderRewardsHandlerOpts, ProviderRewardsHandler, ProviderRewardsItemCountHandler, ProviderRewardsCSVHandler } from './query/handlers/providerRewardsHandler';
import { ProviderReportsHandlerOpts, ProviderReportsHandler, ProviderReportsItemCountHandler, ProviderReportsCSVHandler } from './query/handlers/providerReportsHandler';

import { ProvidersHandler, ProvidersHandlerOpts } from './query/handlers/providersHandler';
import { SpecsHandler, SpecsHandlerOpts } from './query/handlers/specsHandler';
import { SpecHandler, SpecHandlerOpts } from './query/handlers/specHandler';
import { ConsumersHandler, ConsumersHandlerOpts } from './query/handlers/consumersHandler';
import { ConsumerHandler, ConsumerHandlerOpts } from './query/handlers/consumerHandler';
import { EventsHandler, EventsHandlerOpts } from './query/handlers/eventsHandler';
import { ProviderHealthHandler, ProviderHealthHandlerOpts, ProviderHealthItemCountHandler, ProviderHealthCSVHandler } from './query/handlers/providerHealthHandler';

import { LatestHandler, LatestHandlerOpts } from './query/handlers/latestHandler';
import { LavapProviderHealthHandler, LavapProviderHealthHandlerOpts } from './query/handlers/lavapProviderHealthHandler';

RegisterServerHandlerWithCache('/index', IndexHandlerOpts, IndexHandler);
RegisterServerHandlerWithCache('/indexProviders', IndexProvidersHandlerOpts, IndexProvidersHandler, IndexProvidersItemCountHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVHandler);

RegisterServerHandlerWithCache('/provider/:addr', ProviderHandlerOpts, ProviderHandler);

RegisterServerHandlerWithCache('/providerStakes/:addr', ProviderStakesHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountHandler);
RegisterServerHandlerWithCache('/providerEvents/:addr', ProviderEventsHandlerOpts, ProviderEventsHandler, ProviderEventsItemCountHandler);
RegisterServerHandlerWithCache('/providerRewards/:addr', ProviderRewardsHandlerOpts, ProviderRewardsHandler, ProviderRewardsItemCountHandler);
RegisterServerHandlerWithCache('/providerReports/:addr', ProviderReportsHandlerOpts, ProviderReportsHandler, ProviderReportsItemCountHandler);

GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVHandler);

RegisterServerHandlerWithCache('/providers', ProvidersHandlerOpts, ProvidersHandler);
RegisterServerHandlerWithCache('/specs', SpecsHandlerOpts, SpecsHandler);
RegisterServerHandlerWithCache('/consumers', ConsumersHandlerOpts, ConsumersHandler);
RegisterServerHandlerWithCache('/consumer/:addr', ConsumerHandlerOpts, ConsumerHandler);
RegisterServerHandlerWithCache('/spec/:specId', SpecHandlerOpts, SpecHandler);
RegisterServerHandlerWithCache('/events', EventsHandlerOpts, EventsHandler);

RegisterServerHandlerWithCache('/providerHealth/:addr', ProviderHealthHandlerOpts, ProviderHealthHandler, ProviderHealthItemCountHandler);
GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVHandler);


GetServerInstance().get('/latest', LatestHandlerOpts, LatestHandler);

if (consts.JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapProviderHealth', LavapProviderHealthHandlerOpts, LavapProviderHealthHandler);
}

export const queryServerMain = async (): Promise<void> => {
    logger.info('Starting query server')

    await InitDbInstance()
    await InitReadDbInstance()

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

        logger.info(`listening on ${consts.JSINFO_QUERY_PORT} ${consts.JSINFO_QUERY_HOST}`)
        await GetServerInstance().listen({ port: consts.JSINFO_QUERY_PORT, host: consts.JSINFO_QUERY_HOST })
    } catch (err) {
        logger.error(String(err))
        logger.error('Sleeping one second before exit')
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(1)
    }
}


try {
    logger.info(`QueryCache:: JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED: ${consts.JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED}`);
    logger.info(`QueryCache:: JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS: ${consts.JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS}`);
    logger.info(`QueryCache:: JSINFO_QUERY_HIGH_POST_BODY_LIMIT: ${consts.JSINFO_QUERY_HIGH_POST_BODY_LIMIT}`);

    queryServerMain();
} catch (error) {
    if (error instanceof Error) {
        console.error('An error occurred while running the queryserver:', error.message);
        console.error('Stack trace:', error.stack);
    } else {
        console.error('An unknown error occurred while running the queryserver:', error);
    }
}
