// jsinfo/src/query/queryRoutes.ts

import { RegisterPaginationServerHandler, RegisterRedisBackedHandler, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

// -- Server status ajax --
import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/health/latestHandler';
import { IsLatestRawHandler, IsLatestRawHandlerOpts } from './handlers/health/isLatestHandler';

// -- Server supply ajax --
import { SupplyRawHandlerOpts, TotalSupplyRawHandler, CirculatingSupplyRawHandler } from './handlers/ajax/supplyHandler';

// -- list all providers and monikers endpoint ---
import { ListProvidersRawHandlerOpts, ListProvidersRawHandler } from './handlers/ajax/listProvidersHandler';

// -- Server meta ajax --
import { ProvidersPaginatedHandler, ProvidersPaginatedHandlerOpts } from './handlers/ajax/providersHandler';
import { SpecsPaginatedHandler, SpecsPaginatedHandlerOpts } from './handlers/ajax/specsHandler';
import { ConsumersPaginatedHandler, ConsumersPaginatedHandlerOpts } from './handlers/ajax/consumersHandler';

// -- All pages ajax --
import { CacheLinksPaginatedHandler, CacheLinksPaginatedHandlerOpts } from './handlers/ajax/cacheLinksHandler';
import { AutoCompleteLinksPaginatedHandler, AutoCompleteLinksPaginatedHandlerOpts } from './handlers/ajax/autoCompleteLinksHandler';

// -- Index page ajax -- 
import { IndexHandler, IndexHandlerOpts } from './handlers/index/indexHandler';
import { IndexProvidersPaginatedHandler, IndexProvidersPaginatedHandlerOpts, IndexProvidersItemCountPaginatiedHandler, IndexProvidersCSVRawHandler } from './handlers/index/indexProvidersHandler';
import { IndexChartsRawHandler, IndexChartsRawHandlerOpts } from './handlers/index/indexChartsHandler';

// -- Provider page ajax --
import { ProviderPaginatedHandler, ProviderPaginatedHandlerOpts } from './handlers/provider/providerHandler';
import { ProviderCardsHandler, ProviderCardsHandlerOpts } from './handlers/provider/providerCardsHandler';
import { ProviderChartsRawHandler, ProviderChartsRawHandlerOpts } from './handlers/provider/providerChartsHandler';

import { ProviderHealthPaginatedHandler, ProviderHealthPaginatedHandlerOpts, ProviderHealthItemCountPaginatiedHandler, ProviderHealthCSVRawHandler } from './handlers/provider/providerHealthHandler';
import { ProviderErrorsPaginatedHandler, ProviderErrorsPaginatedHandlerOpts, ProviderErrorsItemCountPaginatiedHandler, ProviderErrorsCSVRawHandler } from './handlers/provider/providerErrorsHandler';
import { ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler, ProviderStakesCSVRawHandler } from './handlers/provider/providerStakesHandler';
import { ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler, ProviderEventsCSVRawHandler } from './handlers/provider/providerEventsHandler';
import { ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler, ProviderRewardsCSVRawHandler } from './handlers/provider/providerRewardsHandler';
import { ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler, ProviderReportsCSVRawHandler } from './handlers/provider/providerReportsHandler';
import { ProviderDelegatorRewardsPaginatedHandlerOpts, ProviderDelegatorRewardsPaginatedHandler, ProviderDelegatorRewardsItemCountPaginatiedHandler, ProviderDelegatorRewardsCSVRawHandler } from './handlers/provider/providerDelegatorRewardsHandler';
import { ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler, ProviderBlockReportsCSVRawHandler } from './handlers/provider/providerBlockReportsHandler';

import { ProviderHealthLatestPaginatedHandler, ProviderHealthLatestPaginatedHandlerOpts } from './handlers/provider/providerHealthLatestHandler';
import { ProviderAccountInfoRawHandler, ProviderAccountInfoRawHandlerOpts } from './handlers/provider/providerAccountInfoHandler';

// -- Events page ajax -- 
import { EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler, EventsEventsCSVRawHandler } from './handlers/events/eventsEventsHandler';
import { EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler, EventsRewardsCSVRawHandler } from './handlers/events/eventsRewardsHandler';
import { EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler, EventsReportsCSVRawHandler } from './handlers/events/eventsReportsHandler';

// -- Consumers page ajax -- 
import { ConsumersPageHandler, ConsumersPageHandlerOpts } from './handlers/consumerspage/consumersPageHandler';
import { ConsumersPageChartsRawHandler, ConsumersPageChartsRawHandlerOpts } from './handlers/consumerspage/consumersPageChartsHandler';
import { ConsumersPageConsumersRawHandler, ConsumersPageConsumersRawHandlerOpts } from './handlers/consumerspage/consumersPageConsumersHandler';

// -- Consumer page ajax -- 
import { ConsumerCahcedHandler, ConsumerCahcedHandlerOpts } from './handlers/consumer/consumerHandler';
import { ConsumerSubscriptionItemCountPaginatiedHandler, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionRawHandlerOpts } from './handlers/consumer/consumerSubscriptionHandler';
import { ConsumerChartsRawHandler, ConsumerChartsRawHandlerOpts } from './handlers/consumer/consumerChartsHandler';

// -- Spec page ajax --
import { SpecPaginatedHandler, SpecPaginatedHandlerOpts } from './handlers/spec/specHandler';
import { SpecChartsRawHandler, SpecChartsRawHandlerOpts } from './handlers/spec/specChartsHandler';
import { SpecStakesPaginatedHandler, SpecStakesPaginatedHandlerOpts } from './handlers/spec/specStakesHandler';

import { EventsPaginatedHandler, EventsPaginatedHandlerOpts } from './handlers/events/eventsHandler';

import { SpecProviderHealthHandler, SpecProviderHealthHandlerOpts } from './handlers/spec/specProviderHealthHandler';

// -- Internal data endpoints --
import { LavapDualStackingDelegatorRewardsHandler, LavapDualStackingDelegatorRewardsOpts } from './handlers/pods/lavapDualStackingDelegatorRewardsHandler';

// -- Server status ajax --
GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);
GetServerInstance().get('/islatest', IsLatestRawHandlerOpts, IsLatestRawHandler);
// GetServerInstance().get('/health', HealthRawHandlerOpts, HealthRawHandler);

// -- Server supply ajax --
RegisterRedisBackedHandler('/supply/total', SupplyRawHandlerOpts, TotalSupplyRawHandler, { cache_ttl: 60, is_text: true });
RegisterRedisBackedHandler('/supply/circulating', SupplyRawHandlerOpts, CirculatingSupplyRawHandler, { cache_ttl: 60, is_text: true });

// -- list all providers and monikers endpoint ---
RegisterRedisBackedHandler('/listProviders', ListProvidersRawHandlerOpts, ListProvidersRawHandler, { cache_ttl: 10 * 60 });

// -- Server meta ajax --
RegisterRedisBackedHandler('/providers', ProvidersPaginatedHandlerOpts, ProvidersPaginatedHandler, { cache_ttl: 30 });
RegisterRedisBackedHandler('/specs', SpecsPaginatedHandlerOpts, SpecsPaginatedHandler, { cache_ttl: 30 });
RegisterRedisBackedHandler('/consumers', ConsumersPaginatedHandlerOpts, ConsumersPaginatedHandler, { cache_ttl: 30 });

// -- All pages ajax --
RegisterRedisBackedHandler('/cacheLinks', CacheLinksPaginatedHandlerOpts, CacheLinksPaginatedHandler, { cache_ttl: 60 * 60 });
RegisterRedisBackedHandler('/autoCompleteLinksHandler', AutoCompleteLinksPaginatedHandlerOpts, AutoCompleteLinksPaginatedHandler, { cache_ttl: 10 * 60 });

// -- Index page ajax -- 
RegisterRedisBackedHandler('/index', IndexHandlerOpts, IndexHandler, { cache_ttl: 10 });
RegisterPaginationServerHandler('/indexProviders', IndexProvidersPaginatedHandlerOpts, IndexProvidersPaginatedHandler, IndexProvidersItemCountPaginatiedHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);
GetServerInstance().get('/indexCharts', IndexChartsRawHandlerOpts, IndexChartsRawHandler);

// -- Provider page ajax --
RegisterRedisBackedHandler('/provider/:addr', ProviderPaginatedHandlerOpts, ProviderPaginatedHandler);
RegisterRedisBackedHandler('/providerCards/:addr', ProviderCardsHandlerOpts, ProviderCardsHandler);
GetServerInstance().get('/providerCharts/:addr', ProviderChartsRawHandlerOpts, ProviderChartsRawHandler);

RegisterPaginationServerHandler('/providerHealth/:addr', ProviderHealthPaginatedHandlerOpts, ProviderHealthPaginatedHandler, ProviderHealthItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerErrors/:addr', ProviderErrorsPaginatedHandlerOpts, ProviderErrorsPaginatedHandler, ProviderErrorsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerStakes/:addr', ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerEvents/:addr', ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerRewards/:addr', ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerReports/:addr', ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerDelegatorRewards/:addr', ProviderDelegatorRewardsPaginatedHandlerOpts, ProviderDelegatorRewardsPaginatedHandler, ProviderDelegatorRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerBlockReports/:addr', ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler);

RegisterRedisBackedHandler('/providerLatestHealth/:addr', ProviderHealthLatestPaginatedHandlerOpts, ProviderHealthLatestPaginatedHandler, { cache_ttl: 2 * 60 });
GetServerInstance().get('/providerAccountInfo/:addr', ProviderAccountInfoRawHandlerOpts, ProviderAccountInfoRawHandler);

GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVRawHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVRawHandler);
GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVRawHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVRawHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVRawHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVRawHandler);
GetServerInstance().get('/providerDelegatorRewardsCsv/:addr', ProviderDelegatorRewardsCSVRawHandler);
GetServerInstance().get('/providerBlockReportsCsv/:addr', ProviderBlockReportsCSVRawHandler);

// -- Consumer page ajax --
RegisterRedisBackedHandler('/consumer/:addr', ConsumerCahcedHandlerOpts, ConsumerCahcedHandler);
RegisterPaginationServerHandler('/consumerSubscriptions/:addr', ConsumerSubscriptionRawHandlerOpts, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionItemCountPaginatiedHandler);
GetServerInstance().get('/consumerCharts/:addr', ConsumerChartsRawHandlerOpts, ConsumerChartsRawHandler);

// -- Consumerspage page ajax --
RegisterRedisBackedHandler('/consumerspage', ConsumersPageHandlerOpts, ConsumersPageHandler, { cache_ttl: 10 });
GetServerInstance().get('/consumerspageCharts', ConsumersPageChartsRawHandlerOpts, ConsumersPageChartsRawHandler);
RegisterRedisBackedHandler('/consumerspageConsumers', ConsumersPageConsumersRawHandlerOpts, ConsumersPageConsumersRawHandler, { cache_ttl: 10 });

// -- Events page ajax --
RegisterRedisBackedHandler('/events', EventsPaginatedHandlerOpts, EventsPaginatedHandler, { cache_ttl: 30 });
RegisterPaginationServerHandler('/eventsEvents', EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/eventsRewards', EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/eventsReports', EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler);

GetServerInstance().get('/eventsEventsCsv', EventsEventsCSVRawHandler);
GetServerInstance().get('/eventsRewardsCsv', EventsRewardsCSVRawHandler);
GetServerInstance().get('/eventsReportsCsv', EventsReportsCSVRawHandler);

// -- Spec page ajax --
RegisterPaginationServerHandler('/spec/:specId', SpecPaginatedHandlerOpts, SpecPaginatedHandler);
GetServerInstance().get('/specStakes/:specId', SpecStakesPaginatedHandlerOpts, SpecStakesPaginatedHandler);
GetServerInstance().get('/specCharts/:specId', SpecChartsRawHandlerOpts, SpecChartsRawHandler);

RegisterRedisBackedHandler('/specProviderHealth/:specId/:addr', SpecProviderHealthHandlerOpts, SpecProviderHealthHandler, { cache_ttl: 3 * 60 });

// -- Internal data endpoints --
if (consts.JSINFO_QUERY_LAVAP_DUAL_STACKING_DELEGATOR_REWARDS_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapDualStackingDelegatorRewards', LavapDualStackingDelegatorRewardsOpts, LavapDualStackingDelegatorRewardsHandler);
}
