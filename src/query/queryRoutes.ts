// jsinfo/src/query/queryRoutes.ts

import { RegisterServerHandlerWithCache, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

import { LatestHandler, LatestHandlerOpts } from './handlers/latestHandler';

import { CacheLinksHandler, CacheLinksHandlerOpts } from './handlers/cacheLinksHandler';

import { AutoCompleteLinksHandler, AutoCompleteLinksHandlerOpts } from './handlers/autoCompleteLinksHandler';

import { IndexHandler, IndexHandlerOpts } from './handlers/indexHandler';
import { IndexProvidersHandler, IndexProvidersHandlerOpts, IndexProvidersItemCountHandler, IndexProvidersCSVHandler } from './handlers/indexProvidersHandler';

import { ProviderHandler, ProviderHandlerOpts } from './handlers/providerHandler';
import { ProviderHealthHandler, ProviderHealthHandlerOpts, ProviderHealthItemCountHandler, ProviderHealthCSVHandler } from './handlers/providerHealthHandler';
import { ProviderErrorsHandler, ProviderErrorsHandlerOpts, ProviderErrorsItemCountHandler, ProviderErrorsCSVHandler } from './handlers/providerErrorsHandler';
import { ProviderStakesHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountHandler, ProviderStakesCSVHandler } from './handlers/providerStakesHandler';
import { ProviderEventsHandlerOpts, ProviderEventsHandler, ProviderEventsItemCountHandler, ProviderEventsCSVHandler } from './handlers/providerEventsHandler';
import { ProviderRewardsHandlerOpts, ProviderRewardsHandler, ProviderRewardsItemCountHandler, ProviderRewardsCSVHandler } from './handlers/providerRewardsHandler';
import { ProviderReportsHandlerOpts, ProviderReportsHandler, ProviderReportsItemCountHandler, ProviderReportsCSVHandler } from './handlers/providerReportsHandler';

import { ProvidersHandler, ProvidersHandlerOpts } from './handlers/providersHandler';
import { SpecsHandler, SpecsHandlerOpts } from './handlers/specsHandler';
import { SpecHandler, SpecHandlerOpts } from './handlers/specHandler';
import { ConsumersHandler, ConsumersHandlerOpts } from './handlers/consumersHandler';
import { ConsumerHandler, ConsumerHandlerOpts } from './handlers/consumerHandler';
import { EventsHandler, EventsHandlerOpts } from './handlers/eventsHandler';

import { LavapProviderHealthHandler, LavapProviderHealthHandlerOpts } from './handlers/lavapProviderHealthHandler';


GetServerInstance().get('/latest', LatestHandlerOpts, LatestHandler);

RegisterServerHandlerWithCache('/cacheLinks', CacheLinksHandlerOpts, CacheLinksHandler);

RegisterServerHandlerWithCache('/autoCompleteLinksHandler', AutoCompleteLinksHandlerOpts, AutoCompleteLinksHandler);

RegisterServerHandlerWithCache('/index', IndexHandlerOpts, IndexHandler);
RegisterServerHandlerWithCache('/indexProviders', IndexProvidersHandlerOpts, IndexProvidersHandler, IndexProvidersItemCountHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVHandler);

RegisterServerHandlerWithCache('/provider/:addr', ProviderHandlerOpts, ProviderHandler);

RegisterServerHandlerWithCache('/providerHealth/:addr', ProviderHealthHandlerOpts, ProviderHealthHandler, ProviderHealthItemCountHandler);
RegisterServerHandlerWithCache('/providerErrors/:addr', ProviderErrorsHandlerOpts, ProviderErrorsHandler, ProviderErrorsItemCountHandler);
RegisterServerHandlerWithCache('/providerStakes/:addr', ProviderStakesHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountHandler);
RegisterServerHandlerWithCache('/providerEvents/:addr', ProviderEventsHandlerOpts, ProviderEventsHandler, ProviderEventsItemCountHandler);
RegisterServerHandlerWithCache('/providerRewards/:addr', ProviderRewardsHandlerOpts, ProviderRewardsHandler, ProviderRewardsItemCountHandler);
RegisterServerHandlerWithCache('/providerReports/:addr', ProviderReportsHandlerOpts, ProviderReportsHandler, ProviderReportsItemCountHandler);

GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVHandler);
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

if (consts.JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapProviderHealth', LavapProviderHealthHandlerOpts, LavapProviderHealthHandler);
}



