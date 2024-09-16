// jsinfo/src/query/queryRoutes.ts

import { RegisterPaginationServerHandler, RegisterRedisBackedHandler, GetServerInstance } from './queryServer';
import * as consts from './queryConsts';

// -- Server status ajax --
import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/health/latestHandler';
import { IsLatestRawHandler, IsLatestRawHandlerOpts } from './handlers/health/isLatestHandler';
import { HealthRawHandler, HealthRawHandlerOpts } from './handlers/health/healthHandler';
import { HealthStatusRawHandler, HealthStatusRawHandlerOpts } from './handlers/health/healthStatusHandler';

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
import { AutoCompleteLinksV2PaginatedHandler, AutoCompleteLinksV2PaginatedHandlerOpts } from './handlers/ajax/autoCompleteLinksV2Handler';

// -- Index page ajax -- 
import { IndexHandler, IndexHandlerOpts } from './handlers/index/indexHandler';
import { Index30DayCuHandlerOpts, Index30DayCuHandler } from './handlers/index/index30DayCuHandler';
import { IndexCachedMetricsHandlerOpts, IndexCachedMetricsHandler } from './handlers/index/indexCachedMetricsHandler';
import { IndexLatestBlockHandlerOpts, IndexLatestBlockHandler } from './handlers/index/indexLatestBlockHandler';
import { IndexMonthlyUsersHandlerOpts, IndexMonthlyUsersHandler } from './handlers/index/indexMonthlyUsersHandler';
import { IndexMonthlyUsersAvgHandlerOpts, IndexMonthlyUsersAvgHandler } from './handlers/index/indexMonthlyUsersAvgHandler';
import { IndexTopChainsHandlerOpts, IndexTopChainsHandler } from './handlers/index/indexTopChainsHandler';
import { IndexTotalCuHandlerOpts, IndexTotalCuHandler } from './handlers/index/indexTotalCuHandler';
import { IndexStakesHandlerOpts, IndexStakesHandler } from './handlers/index/indexStakesHandler';

import { IndexProvidersPaginatedHandler, IndexProvidersPaginatedHandlerOpts, IndexProvidersItemCountPaginatiedHandler, IndexProvidersCSVRawHandler } from './handlers/index/indexProvidersHandler';
import { IndexProvidersActivePaginatedHandler, IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActiveItemCountPaginatiedHandler, IndexProvidersActiveCSVRawHandler } from './handlers/index/indexProvidersActiveHandler';

import { IndexChartsRawHandler, IndexChartsRawHandlerOpts } from './handlers/index/indexChartsHandler';
import { IndexChartsV2RawHandler, IndexChartsV2RawHandlerOpts } from './handlers/index/indexChartsV2Handler';
import { IndexChartsV3RawHandler, IndexChartsV3RawHandlerOpts } from './handlers/index/indexChartsV3Handler';
import { IndexUniqueVisitorsChartRawHandler, IndexUniqueVisitorsChartRawHandlerOpts } from './handlers/index/indexUniqueVisitorsChartHandler';

// -- Provider page ajax --
import { ProviderPaginatedHandler, ProviderPaginatedHandlerOpts } from './handlers/provider/providerHandler';
import { ProviderV2PaginatedHandler, ProviderV2PaginatedHandlerOpts } from './handlers/provider/providerV2Handler';
import { ProviderCardsHandler, ProviderCardsHandlerOpts } from './handlers/provider/providerCardsHandler';
import { ProviderCardsClaimableRewardsHandler, ProviderCardsClaimableRewardsHandlerOpts } from './handlers/provider/providerCardsClaimableRewardsHandler';
import { ProviderCardsClaimedRewards30DaysHandler, ProviderCardsClaimedRewards30DaysHandlerOpts } from './handlers/provider/providerCardsClaimedRewards30DaysHandler';
import { ProviderCardsClaimedRewardsAllTimeHandler, ProviderCardsClaimedRewardsAllTimeHandlerOpts } from './handlers/provider/providerCardsClaimedRewardsAllTimeHandler';
import { ProviderCardsCuRelayAndRewardsHandler, ProviderCardsCuRelayAndRewardsHandlerOpts } from './handlers/provider/providerCardsCuRelayAndRewardsHandler';
import { ProviderCardsStakesHandler, ProviderCardsStakesHandlerOpts } from './handlers/provider/providerCardsStakesHandler';
import { ProviderChartsRawHandler, ProviderChartsRawHandlerOpts } from './handlers/provider/providerChartsHandler';
import { ProviderChartsV2RawHandler, ProviderChartsV2RawHandlerOpts } from './handlers/provider/providerChartsV2Handler';

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
import { EventsPaginatedHandler, EventsPaginatedHandlerOpts } from './handlers/events/eventsHandler';
import { EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler, EventsEventsCSVRawHandler } from './handlers/events/eventsEventsHandler';
import { EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler, EventsRewardsCSVRawHandler } from './handlers/events/eventsRewardsHandler';
import { EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler, EventsReportsCSVRawHandler } from './handlers/events/eventsReportsHandler';

// -- Consumers page ajax -- 
import { ConsumersPageHandler, ConsumersPageHandlerOpts } from './handlers/consumerspage/consumersPageHandler';
import { ConsumersPageConsumersRawHandler, ConsumersPageConsumersRawHandlerOpts } from './handlers/consumerspage/consumersPageConsumersHandler';

// -- Consumer page ajax -- 
import { ConsumerCahcedHandler, ConsumerCahcedHandlerOpts } from './handlers/consumer/consumerHandler';
import { ConsumerSubscriptionItemCountPaginatiedHandler, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionRawHandlerOpts } from './handlers/consumer/consumerSubscriptionHandler';
import { ConsumerChartsRawHandler, ConsumerChartsRawHandlerOpts } from './handlers/consumer/consumerChartsHandler';
import { ConsumerEventsPaginatedHandlerOpts, ConsumerEventsPaginatedHandler, ConsumerEventsItemCountPaginatiedHandler } from './handlers/consumer/consumerEventsHandler';
import { ConsumerConflictsHandler, ConsumerConflictsHandlerOpts } from './handlers/consumer/consumerConflictsHandler';

// -- Spec page ajax --
import { SpecPaginatedHandler, SpecPaginatedHandlerOpts } from './handlers/spec/specHandler';
import { SpecChartsRawHandler, SpecChartsRawHandlerOpts } from './handlers/spec/specChartsHandler';
import { SpecChartsV2RawHandler, SpecChartsV2RawHandlerOpts } from './handlers/spec/specChartsV2Handler';
import { SpecStakesPaginatedHandler, SpecStakesPaginatedHandlerOpts } from './handlers/spec/specStakesHandler';
import { SpecProviderHealthHandler, SpecProviderHealthHandlerOpts } from './handlers/spec/specProviderHealthHandler';

// -- Internal data endpoints --
import { LavapDualStackingDelegatorRewardsHandler, LavapDualStackingDelegatorRewardsOpts } from './handlers/pods/lavapDualStackingDelegatorRewardsHandler';
import { ConsumerV2CahcedHandler, ConsumerV2CahcedHandlerOpts } from './handlers/consumer/consumerV2Handler';

// -- Server status ajax --
GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);
GetServerInstance().get('/islatest', IsLatestRawHandlerOpts, IsLatestRawHandler);
GetServerInstance().get('/health', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healths', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healthz', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healthstatus', HealthStatusRawHandlerOpts, HealthStatusRawHandler);

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
RegisterRedisBackedHandler('/autoCompleteLinksV2Handler', AutoCompleteLinksV2PaginatedHandlerOpts, AutoCompleteLinksV2PaginatedHandler, { cache_ttl: 10 * 60 });

// -- Index page ajax -- 
RegisterRedisBackedHandler('/index', IndexHandlerOpts, IndexHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/index30DayCu', Index30DayCuHandlerOpts, Index30DayCuHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexCachedMetrics', IndexCachedMetricsHandlerOpts, IndexCachedMetricsHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexLatestBlock', IndexLatestBlockHandlerOpts, IndexLatestBlockHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexMonthlyUsers', IndexMonthlyUsersHandlerOpts, IndexMonthlyUsersHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexMonthlyUsersAvg', IndexMonthlyUsersAvgHandlerOpts, IndexMonthlyUsersAvgHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexTopChains', IndexTopChainsHandlerOpts, IndexTopChainsHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexTotalCu', IndexTotalCuHandlerOpts, IndexTotalCuHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexStakesHandler', IndexStakesHandlerOpts, IndexStakesHandler, { cache_ttl: 10 });
RegisterPaginationServerHandler('/indexProviders', IndexProvidersPaginatedHandlerOpts, IndexProvidersPaginatedHandler, IndexProvidersItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/indexProvidersActive', IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActivePaginatedHandler, IndexProvidersActiveItemCountPaginatiedHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);
GetServerInstance().get('/indexProvidersActiveCsv', IndexProvidersActiveCSVRawHandler);
GetServerInstance().get('/indexCharts', IndexChartsRawHandlerOpts, IndexChartsRawHandler);
GetServerInstance().get('/indexChartsV2', IndexChartsV2RawHandlerOpts, IndexChartsV2RawHandler);
GetServerInstance().get('/indexChartsV3', IndexChartsV3RawHandlerOpts, IndexChartsV3RawHandler);
RegisterRedisBackedHandler('/indexUniqueVisitorsChart', IndexUniqueVisitorsChartRawHandlerOpts, IndexUniqueVisitorsChartRawHandler, { cache_ttl: 60 * 60 });

// -- Provider page ajax --
RegisterRedisBackedHandler('/provider/:addr', ProviderPaginatedHandlerOpts, ProviderPaginatedHandler);
RegisterRedisBackedHandler('/providerV2/:addr', ProviderV2PaginatedHandlerOpts, ProviderV2PaginatedHandler);
RegisterRedisBackedHandler('/providerCards/:addr', ProviderCardsHandlerOpts, ProviderCardsHandler);
RegisterRedisBackedHandler('/providerCardsClaimableRewards/:addr', ProviderCardsClaimableRewardsHandlerOpts, ProviderCardsClaimableRewardsHandler);
RegisterRedisBackedHandler('/providerCardsClaimedRewards30Days/:addr', ProviderCardsClaimedRewards30DaysHandlerOpts, ProviderCardsClaimedRewards30DaysHandler);
RegisterRedisBackedHandler('/providerCardsClaimedRewardsAllTime/:addr', ProviderCardsClaimedRewardsAllTimeHandlerOpts, ProviderCardsClaimedRewardsAllTimeHandler);
RegisterRedisBackedHandler('/providerCardsCuRelayAndRewards/:addr', ProviderCardsCuRelayAndRewardsHandlerOpts, ProviderCardsCuRelayAndRewardsHandler);
RegisterRedisBackedHandler('/providerCardsStakes/:addr', ProviderCardsStakesHandlerOpts, ProviderCardsStakesHandler);
GetServerInstance().get('/providerCharts/:addr', ProviderChartsRawHandlerOpts, ProviderChartsRawHandler);
GetServerInstance().get('/providerChartsV2/:specId/:addr', ProviderChartsV2RawHandlerOpts, ProviderChartsV2RawHandler);

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
RegisterRedisBackedHandler('/consumerV2/:addr', ConsumerV2CahcedHandlerOpts, ConsumerV2CahcedHandler);
RegisterPaginationServerHandler('/consumerSubscriptions/:addr', ConsumerSubscriptionRawHandlerOpts, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionItemCountPaginatiedHandler);
RegisterRedisBackedHandler('/consumerConflicts/:addr', ConsumerConflictsHandlerOpts, ConsumerConflictsHandler, { cache_ttl: 10 });
GetServerInstance().get('/consumerCharts/:addr', ConsumerChartsRawHandlerOpts, ConsumerChartsRawHandler);
RegisterPaginationServerHandler('/consumerEvents/:addr', ConsumerEventsPaginatedHandlerOpts, ConsumerEventsPaginatedHandler, ConsumerEventsItemCountPaginatiedHandler);

// -- Consumerspage page ajax --
RegisterRedisBackedHandler('/consumerspage', ConsumersPageHandlerOpts, ConsumersPageHandler, { cache_ttl: 60 });
RegisterRedisBackedHandler('/consumerspageConsumers', ConsumersPageConsumersRawHandlerOpts, ConsumersPageConsumersRawHandler, { cache_ttl: 60 });

// -- Events page ajax --
RegisterRedisBackedHandler('/events', EventsPaginatedHandlerOpts, EventsPaginatedHandler, { cache_ttl: 20 });
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
GetServerInstance().get('/specChartsV2/:specId/:addr', SpecChartsV2RawHandlerOpts, SpecChartsV2RawHandler);

RegisterRedisBackedHandler('/specProviderHealth/:specId/:addr', SpecProviderHealthHandlerOpts, SpecProviderHealthHandler, { cache_ttl: 10 });

// -- Internal data endpoints --
if (consts.JSINFO_QUERY_LAVAP_DUAL_STACKING_DELEGATOR_REWARDS_ENDPOINT_ENABLED) {
    GetServerInstance().post('/lavapDualStackingDelegatorRewards', LavapDualStackingDelegatorRewardsOpts, LavapDualStackingDelegatorRewardsHandler);
}
