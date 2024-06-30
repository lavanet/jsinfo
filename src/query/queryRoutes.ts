// jsinfo/src/query/queryRoutes.ts

import { RegistePaginationServerHandler, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

// -- Server status ajax --
import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/latestHandler';

// -- Server meta ajax --
import { ProvidersCachedHandler, ProvidersCachedHandlerOpts } from './handlers/providersHandler';
import { SpecsCachedHandler, SpecsCachedHandlerOpts } from './handlers/specsHandler';
import { ConsumersCachedHandler, ConsumersCachedHandlerOpts } from './handlers/consumersHandler';

// -- All pages ajax --
import { CacheLinksCachedHandler, CacheLinksCachedHandlerOpts } from './handlers/cacheLinksHandler';
import { AutoCompleteLinksCachedHandler, AutoCompleteLinksCachedHandlerOpts } from './handlers/autoCompleteLinksHandler';

// -- Index page ajax -- 
import { IndexHandler, IndexHandlerOpts } from './handlers/indexHandler';
import { IndexProvidersCachedHandler, IndexProvidersCachedHandlerOpts, IndexProvidersItemCountRawHandler, IndexProvidersCSVRawHandler } from './handlers/indexProvidersHandler';
import { IndexChartsRawHandler, IndexChartsRawHandlerOpts } from './handlers/indexChartsHandler';

// -- Provider page ajax --
import { ProviderCachedHandler, ProviderCachedHandlerOpts } from './handlers/providerHandler';

import { ProviderChartsRawHandler, ProviderChartsRawHandlerOpts } from './handlers/providerChartsHandler';

import { ProviderHealthCachedHandler, ProviderHealthCachedHandlerOpts, ProviderHealthItemCountRawHandler, ProviderHealthCSVRawHandler } from './handlers/providerHealthHandler';
import { ProviderErrorsCachedHandler, ProviderErrorsCachedHandlerOpts, ProviderErrorsItemCountRawHandler, ProviderErrorsCSVRawHandler } from './handlers/providerErrorsHandler';
import { ProviderStakesCachedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountRawHandler, ProviderStakesCSVRawHandler } from './handlers/providerStakesHandler';
import { ProviderEventsCachedHandlerOpts, ProviderEventsCachedHandler, ProviderEventsItemCountRawHandler, ProviderEventsCSVRawHandler } from './handlers/providerEventsHandler';
import { ProviderRewardsCachedHandlerOpts, ProviderRewardsCachedHandler, ProviderRewardsItemCountRawHandler, ProviderRewardsCSVRawHandler } from './handlers/providerRewardsHandler';
import { ProviderReportsCachedHandlerOpts, ProviderReportsCachedHandler, ProviderReportsItemCountRawHandler, ProviderReportsCSVRawHandler } from './handlers/providerReportsHandler';
import { ProviderDelegatorRewardsCachedHandlerOpts, ProviderDelegatorRewardsCachedHandler, ProviderDelegatorRewardsItemCountRawHandler, ProviderDelegatorRewardsCSVRawHandler } from './handlers/providerDelegatorRewardsHandler';
import { ProviderBlockReportsCachedHandlerOpts, ProviderBlockReportsCachedHandler, ProviderBlockReportsItemCountRawHandler, ProviderBlockReportsCSVRawHandler } from './handlers/providerBlockReportsHandler';
import { ProviderHealthLatestCachedHandler, ProviderHealthLatestCachedHandlerOpts } from './handlers/providerHealthLatestHandler';

// -- Events page ajax -- 
import { EventsEventsCachedHandlerOpts, EventsEventsCachedHandler, EventsEventsItemCountRawHandler, EventsEventsCSVRawHandler } from './handlers/eventsEventsHandler';
import { EventsRewardsCachedHandlerOpts, EventsRewardsCachedHandler, EventsRewardsItemCountRawHandler, EventsRewardsCSVRawHandler } from './handlers/eventsRewardsHandler';
import { EventsReportsCachedHandlerOpts, EventsReportsCachedHandler, EventsReportsItemCountRawHandler, EventsReportsCSVRawHandler } from './handlers/eventsReportsHandler';

// -- Spec page ajax --
import { SpecCachedHandler, SpecCachedHandlerOpts } from './handlers/specHandler';
import { SpecChartsRawHandler, SpecChartsRawHandlerOpts } from './handlers/specChartsHandler';
import { SpecStakesCachedHandler, SpecStakesCachedHandlerOpts, SpecStakesItemCountRawHandler, SpecStakesCSVRawHandler } from './handlers/specStakesHandler';

import { ConsumerCahcedHandler, ConsumerCahcedHandlerOpts } from './handlers/consumerHandler';
import { EventsCachedHandler, EventsCachedHandlerOpts } from './handlers/eventsHandler';

// -- Internal data endpoints --
import { LavapDualStackingDelegatorRewardsHandler, LavapDualStackingDelegatorRewardsOpts } from './handlers/lavapDualStackingDelegatorRewardsHandler';

// -- Server status ajax --
GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);

// -- Server meta ajax --
RegistePaginationServerHandler('/providers', ProvidersCachedHandlerOpts, ProvidersCachedHandler);
RegistePaginationServerHandler('/specs', SpecsCachedHandlerOpts, SpecsCachedHandler);
RegistePaginationServerHandler('/consumers', ConsumersCachedHandlerOpts, ConsumersCachedHandler);

// -- All pages ajax --
RegistePaginationServerHandler('/cacheLinks', CacheLinksCachedHandlerOpts, CacheLinksCachedHandler);
RegistePaginationServerHandler('/autoCompleteLinksHandler', AutoCompleteLinksCachedHandlerOpts, AutoCompleteLinksCachedHandler);

// -- Index page ajax -- 
RegistePaginationServerHandler('/index', IndexHandlerOpts, IndexHandler);
RegistePaginationServerHandler('/indexProviders', IndexProvidersCachedHandlerOpts, IndexProvidersCachedHandler, IndexProvidersItemCountRawHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);
GetServerInstance().get('/indexCharts', IndexChartsRawHandlerOpts, IndexChartsRawHandler);

// -- Provider page ajax --
RegistePaginationServerHandler('/provider/:addr', ProviderCachedHandlerOpts, ProviderCachedHandler);
GetServerInstance().get('/providerCharts/:addr', ProviderChartsRawHandlerOpts, ProviderChartsRawHandler);

RegistePaginationServerHandler('/providerHealth/:addr', ProviderHealthCachedHandlerOpts, ProviderHealthCachedHandler, ProviderHealthItemCountRawHandler);
RegistePaginationServerHandler('/providerErrors/:addr', ProviderErrorsCachedHandlerOpts, ProviderErrorsCachedHandler, ProviderErrorsItemCountRawHandler);
RegistePaginationServerHandler('/providerStakes/:addr', ProviderStakesCachedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountRawHandler);
RegistePaginationServerHandler('/providerEvents/:addr', ProviderEventsCachedHandlerOpts, ProviderEventsCachedHandler, ProviderEventsItemCountRawHandler);
RegistePaginationServerHandler('/providerRewards/:addr', ProviderRewardsCachedHandlerOpts, ProviderRewardsCachedHandler, ProviderRewardsItemCountRawHandler);
RegistePaginationServerHandler('/providerReports/:addr', ProviderReportsCachedHandlerOpts, ProviderReportsCachedHandler, ProviderReportsItemCountRawHandler);
RegistePaginationServerHandler('/providerDelegatorRewards/:addr', ProviderDelegatorRewardsCachedHandlerOpts, ProviderDelegatorRewardsCachedHandler, ProviderDelegatorRewardsItemCountRawHandler);
RegistePaginationServerHandler('/providerBlockReports/:addr', ProviderBlockReportsCachedHandlerOpts, ProviderBlockReportsCachedHandler, ProviderBlockReportsItemCountRawHandler);
RegistePaginationServerHandler('/providerLatestHealth/:addr', ProviderHealthLatestCachedHandlerOpts, ProviderHealthLatestCachedHandler);

GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVRawHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVRawHandler);
GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVRawHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVRawHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVRawHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVRawHandler);
GetServerInstance().get('/providerDelegatorRewardsCsv/:addr', ProviderDelegatorRewardsCSVRawHandler);
GetServerInstance().get('/providerBlockReportsCsv/:addr', ProviderBlockReportsCSVRawHandler);

RegistePaginationServerHandler('/consumer/:addr', ConsumerCahcedHandlerOpts, ConsumerCahcedHandler);

// -- Events page ajax --
RegistePaginationServerHandler('/events', EventsCachedHandlerOpts, EventsCachedHandler);
RegistePaginationServerHandler('/eventsEvents', EventsEventsCachedHandlerOpts, EventsEventsCachedHandler, EventsEventsItemCountRawHandler);
RegistePaginationServerHandler('/eventsRewards', EventsRewardsCachedHandlerOpts, EventsRewardsCachedHandler, EventsRewardsItemCountRawHandler);
RegistePaginationServerHandler('/eventsReports', EventsReportsCachedHandlerOpts, EventsReportsCachedHandler, EventsReportsItemCountRawHandler);

GetServerInstance().get('/eventsEventsCsv', EventsEventsCSVRawHandler);
GetServerInstance().get('/eventsRewardsCsv', EventsRewardsCSVRawHandler);
GetServerInstance().get('/eventsReportsCsv', EventsReportsCSVRawHandler);

// -- Spec page ajax --
RegistePaginationServerHandler('/spec/:specId', SpecCachedHandlerOpts, SpecCachedHandler);
RegistePaginationServerHandler('/specStakes/:specId', SpecStakesCachedHandlerOpts, SpecStakesCachedHandler, SpecStakesItemCountRawHandler);
GetServerInstance().get('/specStakesCsv/:specId', SpecStakesCSVRawHandler);
GetServerInstance().get('/specCharts/:specId', SpecChartsRawHandlerOpts, SpecChartsRawHandler);

// -- Internal data endpoints --
if (consts.JSINFO_QUERY_LAVAP_DUAL_STACKING_DELEGATOR_REWARDS_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapDualStackingDelegatorRewards', LavapDualStackingDelegatorRewardsOpts, LavapDualStackingDelegatorRewardsHandler);
}



