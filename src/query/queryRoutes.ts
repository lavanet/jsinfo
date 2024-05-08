// jsinfo/src/query/queryRoutes.ts

import { RegisterServerHandlerWithCache, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/latestHandler';

import { CacheLinksCachedHandler, CacheLinksCachedHandlerOpts } from './handlers/cacheLinksHandler';

import { AutoCompleteLinksCachedHandler, AutoCompleteLinksCachedHandlerOpts } from './handlers/autoCompleteLinksHandler';

import { IndexHandler, IndexHandlerOpts } from './handlers/indexHandler';
import { IndexChartsRawHandler, IndexChartsRawHandlerOpts } from './handlers/indexChartsHandler';
import { IndexProvidersCachedHandler, IndexProvidersCachedHandlerOpts, IndexProvidersItemCountRawHandler, IndexProvidersCSVRawHandler } from './handlers/indexProvidersHandler';

import { ProviderHandler, ProviderHandlerOpts } from './handlers/providerHandler';
import { ProviderHealthCachedHandler, ProviderHealthCachedHandlerOpts, ProviderHealthItemCountRawHandler, ProviderHealthCSVRawHandler } from './handlers/providerHealthHandler';
import { ProviderErrorsCachedHandler, ProviderErrorsCachedHandlerOpts, ProviderErrorsItemCountRawHandler, ProviderErrorsCSVRawHandler } from './handlers/providerErrorsHandler';
import { ProviderStakesCachedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountRawHandler, ProviderStakesCSVRawHandler } from './handlers/providerStakesHandler';
import { ProviderEventsCachedHandlerOpts, ProviderEventsCachedHandler, ProviderEventsItemCountRawHandler, ProviderEventsCSVRawHandler } from './handlers/providerEventsHandler';
import { ProviderRewardsCachedHandlerOpts, ProviderRewardsCachedHandler, ProviderRewardsItemCountRawHandler, ProviderRewardsCSVRawHandler } from './handlers/providerRewardsHandler';
import { ProviderReportsCachedHandlerOpts, ProviderReportsCachedHandler, ProviderReportsItemCountRawHandler, ProviderReportsCSVRawHandler } from './handlers/providerReportsHandler';
import { ProviderDelegatorRewardsCachedHandlerOpts, ProviderDelegatorRewardsCachedHandler, ProviderDelegatorRewardsItemCountRawHandler, ProviderDelegatorRewardsCSVRawHandler } from './handlers/providerDelegatorRewardsHandler';
import { ProviderBlockReportsCachedHandlerOpts, ProviderBlockReportsCachedHandler, ProviderBlockReportsItemCountRawHandler, ProviderBlockReportsCSVRawHandler } from './handlers/providerBlockReportsHandler';

import { EventsEventsCachedHandlerOpts, EventsEventsCachedHandler, EventsEventsItemCountRawHandler, EventsEventsCSVRawHandler } from './handlers/eventsEventsHandler';
import { EventsRewardsCachedHandlerOpts, EventsRewardsCachedHandler, EventsRewardsItemCountRawHandler, EventsRewardsCSVRawHandler } from './handlers/eventsRewardsHandler';
import { EventsReportsCachedHandlerOpts, EventsReportsCachedHandler, EventsReportsItemCountRawHandler, EventsReportsCSVRawHandler } from './handlers/eventsReportsHandler';

import { ProvidersCachedHandler, ProvidersCachedHandlerOpts } from './handlers/providersHandler';
import { SpecsCachedHandler, SpecsCachedHandlerOpts } from './handlers/specsHandler';
import { SpecCachedHandler, SpecCachedHandlerOpts } from './handlers/specHandler';
import { ConsumersCachedHandler, ConsumersCachedHandlerOpts } from './handlers/consumersHandler';
import { ConsumerCahcedHandler, ConsumerCahcedHandlerOpts } from './handlers/consumerHandler';
import { EventsCachedHandler, EventsCachedHandlerOpts } from './handlers/eventsHandler';

import { LavapProviderHealthHandler, LavapProviderHealthHandlerOpts } from './handlers/lavapProviderHealthHandler';
import { LavapDualStackingDelegatorRewardsHandler, LavapDualStackingDelegatorRewardsOpts } from './handlers/lavapDualStackingDelegatorRewardsHandler';

GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);

RegisterServerHandlerWithCache('/cacheLinks', CacheLinksCachedHandlerOpts, CacheLinksCachedHandler);

RegisterServerHandlerWithCache('/autoCompleteLinksHandler', AutoCompleteLinksCachedHandlerOpts, AutoCompleteLinksCachedHandler);

RegisterServerHandlerWithCache('/index', IndexHandlerOpts, IndexHandler);
RegisterServerHandlerWithCache('/indexProviders', IndexProvidersCachedHandlerOpts, IndexProvidersCachedHandler, IndexProvidersItemCountRawHandler);

GetServerInstance().get('/indexCharts', IndexChartsRawHandlerOpts, IndexChartsRawHandler);

GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);

RegisterServerHandlerWithCache('/provider/:addr', ProviderHandlerOpts, ProviderHandler);

RegisterServerHandlerWithCache('/providerHealth/:addr', ProviderHealthCachedHandlerOpts, ProviderHealthCachedHandler, ProviderHealthItemCountRawHandler);
RegisterServerHandlerWithCache('/providerErrors/:addr', ProviderErrorsCachedHandlerOpts, ProviderErrorsCachedHandler, ProviderErrorsItemCountRawHandler);
RegisterServerHandlerWithCache('/providerStakes/:addr', ProviderStakesCachedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountRawHandler);
RegisterServerHandlerWithCache('/providerEvents/:addr', ProviderEventsCachedHandlerOpts, ProviderEventsCachedHandler, ProviderEventsItemCountRawHandler);
RegisterServerHandlerWithCache('/providerRewards/:addr', ProviderRewardsCachedHandlerOpts, ProviderRewardsCachedHandler, ProviderRewardsItemCountRawHandler);
RegisterServerHandlerWithCache('/providerReports/:addr', ProviderReportsCachedHandlerOpts, ProviderReportsCachedHandler, ProviderReportsItemCountRawHandler);
RegisterServerHandlerWithCache('/providerDelegatorRewards/:addr', ProviderDelegatorRewardsCachedHandlerOpts, ProviderDelegatorRewardsCachedHandler, ProviderDelegatorRewardsItemCountRawHandler);
RegisterServerHandlerWithCache('/providerBlockReports/:addr', ProviderBlockReportsCachedHandlerOpts, ProviderBlockReportsCachedHandler, ProviderBlockReportsItemCountRawHandler);

GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVRawHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVRawHandler);
GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVRawHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVRawHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVRawHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVRawHandler);
GetServerInstance().get('/providerDelegatorRewardsCsv/:addr', ProviderDelegatorRewardsCSVRawHandler);
GetServerInstance().get('/providerBlockReportsCsv/:addr', ProviderBlockReportsCSVRawHandler);

RegisterServerHandlerWithCache('/providers', ProvidersCachedHandlerOpts, ProvidersCachedHandler);
RegisterServerHandlerWithCache('/specs', SpecsCachedHandlerOpts, SpecsCachedHandler);
RegisterServerHandlerWithCache('/consumers', ConsumersCachedHandlerOpts, ConsumersCachedHandler);
RegisterServerHandlerWithCache('/consumer/:addr', ConsumerCahcedHandlerOpts, ConsumerCahcedHandler);
RegisterServerHandlerWithCache('/spec/:specId', SpecCachedHandlerOpts, SpecCachedHandler);

RegisterServerHandlerWithCache('/events', EventsCachedHandlerOpts, EventsCachedHandler);
RegisterServerHandlerWithCache('/eventsEvents', EventsEventsCachedHandlerOpts, EventsEventsCachedHandler, EventsEventsItemCountRawHandler);
RegisterServerHandlerWithCache('/eventsRewards', EventsRewardsCachedHandlerOpts, EventsRewardsCachedHandler, EventsRewardsItemCountRawHandler);
RegisterServerHandlerWithCache('/eventsReports', EventsReportsCachedHandlerOpts, EventsReportsCachedHandler, EventsReportsItemCountRawHandler);

GetServerInstance().get('/eventsEventsCsv', EventsEventsCSVRawHandler);
GetServerInstance().get('/eventsRewardsCsv', EventsRewardsCSVRawHandler);
GetServerInstance().get('/eventsReportsCsv', EventsReportsCSVRawHandler);

if (consts.JSINFO_QUERY_LAVAP_PROVIDER_HEALTH_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapProviderHealth', LavapProviderHealthHandlerOpts, LavapProviderHealthHandler);
}

if (consts.JSINFO_QUERY_LAVAP_DUAL_STACKING_DELEGATOR_REWARDS_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapDualStackingDelegatorRewards', LavapDualStackingDelegatorRewardsOpts, LavapDualStackingDelegatorRewardsHandler);
}



