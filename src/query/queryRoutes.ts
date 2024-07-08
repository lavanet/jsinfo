// jsinfo/src/query/queryRoutes.ts

import { RegistePaginationServerHandler, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

// -- Server status ajax --
import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/latestHandler';

// -- list all providers and monikers endpoint ---
import { ListProvidersRawHandlerOpts, ListProvidersRawHandler } from './handlers/listProvidersHandler';

// -- Server meta ajax --
import { ProvidersPaginatedHandler, ProvidersPaginatedHandlerOpts } from './handlers/providersHandler';
import { SpecsPaginatedHandler, SpecsPaginatedHandlerOpts } from './handlers/specsHandler';
import { ConsumersPaginatedHandler, ConsumersPaginatedHandlerOpts } from './handlers/consumersHandler';

// -- All pages ajax --
import { CacheLinksPaginatedHandler, CacheLinksPaginatedHandlerOpts } from './handlers/cacheLinksHandler';
import { AutoCompleteLinksPaginatedHandler, AutoCompleteLinksPaginatedHandlerOpts } from './handlers/autoCompleteLinksHandler';

// -- Index page ajax -- 
import { IndexHandler, IndexHandlerOpts } from './handlers/indexHandler';
import { IndexProvidersPaginatedHandler, IndexProvidersPaginatedHandlerOpts, IndexProvidersItemCountPaginatiedHandler, IndexProvidersCSVRawHandler } from './handlers/indexProvidersHandler';
import { IndexChartsRawHandler, IndexChartsRawHandlerOpts } from './handlers/indexChartsHandler';

// -- Provider page ajax --
import { ProviderPaginatedHandler, ProviderPaginatedHandlerOpts } from './handlers/providerHandler';

import { ProviderChartsRawHandler, ProviderChartsRawHandlerOpts } from './handlers/providerChartsHandler';

import { ProviderHealthPaginatedHandler, ProviderHealthPaginatedHandlerOpts, ProviderHealthItemCountPaginatiedHandler, ProviderHealthCSVRawHandler } from './handlers/providerHealthHandler';
import { ProviderErrorsPaginatedHandler, ProviderErrorsPaginatedHandlerOpts, ProviderErrorsItemCountPaginatiedHandler, ProviderErrorsCSVRawHandler } from './handlers/providerErrorsHandler';
import { ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler, ProviderStakesCSVRawHandler } from './handlers/providerStakesHandler';
import { ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler, ProviderEventsCSVRawHandler } from './handlers/providerEventsHandler';
import { ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler, ProviderRewardsCSVRawHandler } from './handlers/providerRewardsHandler';
import { ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler, ProviderReportsCSVRawHandler } from './handlers/providerReportsHandler';
import { ProviderDelegatorRewardsPaginatedHandlerOpts, ProviderDelegatorRewardsPaginatedHandler, ProviderDelegatorRewardsItemCountPaginatiedHandler, ProviderDelegatorRewardsCSVRawHandler } from './handlers/providerDelegatorRewardsHandler';
import { ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler, ProviderBlockReportsCSVRawHandler } from './handlers/providerBlockReportsHandler';
import { ProviderHealthLatestPaginatedHandler, ProviderHealthLatestPaginatedHandlerOpts } from './handlers/providerHealthLatestHandler';

// -- Events page ajax -- 
import { EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler, EventsEventsCSVRawHandler } from './handlers/eventsEventsHandler';
import { EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler, EventsRewardsCSVRawHandler } from './handlers/eventsRewardsHandler';
import { EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler, EventsReportsCSVRawHandler } from './handlers/eventsReportsHandler';

// -- Spec page ajax --
import { SpecPaginatedHandler, SpecPaginatedHandlerOpts } from './handlers/specHandler';
import { SpecChartsRawHandler, SpecChartsRawHandlerOpts } from './handlers/specChartsHandler';
import { SpecStakesPaginatedHandler, SpecStakesPaginatedHandlerOpts } from './handlers/specStakesHandler';

import { ConsumerCahcedHandler, ConsumerCahcedHandlerOpts } from './handlers/consumerHandler';
import { EventsPaginatedHandler, EventsPaginatedHandlerOpts } from './handlers/eventsHandler';

// -- Internal data endpoints --
import { LavapDualStackingDelegatorRewardsHandler, LavapDualStackingDelegatorRewardsOpts } from './handlers/lavapDualStackingDelegatorRewardsHandler';


// -- Server status ajax --
GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);

// -- list all providers and monikers endpoint ---
RegisterServerHandlerWithCache('/listProviders', ListProvidersRawHandlerOpts, ListProvidersRawHandler);

// -- Server meta ajax --
RegistePaginationServerHandler('/providers', ProvidersPaginatedHandlerOpts, ProvidersPaginatedHandler);
RegistePaginationServerHandler('/specs', SpecsPaginatedHandlerOpts, SpecsPaginatedHandler);
RegistePaginationServerHandler('/consumers', ConsumersPaginatedHandlerOpts, ConsumersPaginatedHandler);

// -- All pages ajax --
RegistePaginationServerHandler('/cacheLinks', CacheLinksPaginatedHandlerOpts, CacheLinksPaginatedHandler);
RegistePaginationServerHandler('/autoCompleteLinksHandler', AutoCompleteLinksPaginatedHandlerOpts, AutoCompleteLinksPaginatedHandler);

// -- Index page ajax -- 
RegistePaginationServerHandler('/index', IndexHandlerOpts, IndexHandler);
RegistePaginationServerHandler('/indexProviders', IndexProvidersPaginatedHandlerOpts, IndexProvidersPaginatedHandler, IndexProvidersItemCountPaginatiedHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);
GetServerInstance().get('/indexCharts', IndexChartsRawHandlerOpts, IndexChartsRawHandler);

// -- Provider page ajax --
RegistePaginationServerHandler('/provider/:addr', ProviderPaginatedHandlerOpts, ProviderPaginatedHandler);
GetServerInstance().get('/providerCharts/:addr', ProviderChartsRawHandlerOpts, ProviderChartsRawHandler);

RegistePaginationServerHandler('/providerHealth/:addr', ProviderHealthPaginatedHandlerOpts, ProviderHealthPaginatedHandler, ProviderHealthItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerErrors/:addr', ProviderErrorsPaginatedHandlerOpts, ProviderErrorsPaginatedHandler, ProviderErrorsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerStakes/:addr', ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerEvents/:addr', ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerRewards/:addr', ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerReports/:addr', ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerDelegatorRewards/:addr', ProviderDelegatorRewardsPaginatedHandlerOpts, ProviderDelegatorRewardsPaginatedHandler, ProviderDelegatorRewardsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerBlockReports/:addr', ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/providerLatestHealth/:addr', ProviderHealthLatestPaginatedHandlerOpts, ProviderHealthLatestPaginatedHandler);

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
RegistePaginationServerHandler('/events', EventsPaginatedHandlerOpts, EventsPaginatedHandler);
RegistePaginationServerHandler('/eventsEvents', EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/eventsRewards', EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler);
RegistePaginationServerHandler('/eventsReports', EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler);

GetServerInstance().get('/eventsEventsCsv', EventsEventsCSVRawHandler);
GetServerInstance().get('/eventsRewardsCsv', EventsRewardsCSVRawHandler);
GetServerInstance().get('/eventsReportsCsv', EventsReportsCSVRawHandler);

// -- Spec page ajax --
RegistePaginationServerHandler('/spec/:specId', SpecPaginatedHandlerOpts, SpecPaginatedHandler);
GetServerInstance().get('/specStakes/:specId', SpecStakesPaginatedHandlerOpts, SpecStakesPaginatedHandler);
GetServerInstance().get('/specCharts/:specId', SpecChartsRawHandlerOpts, SpecChartsRawHandler);

// -- Internal data endpoints --
if (consts.JSINFO_QUERY_LAVAP_DUAL_STACKING_DELEGATOR_REWARDS_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapDualStackingDelegatorRewards', LavapDualStackingDelegatorRewardsOpts, LavapDualStackingDelegatorRewardsHandler);
}



