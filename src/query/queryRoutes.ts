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

// -- Server supply ajax --
import { APRRawHandlerOpts, APRRawHandler } from './handlers/ajax/aprHandler';

// -- list all providers and monikers endpoint ---
import { ListProvidersRawHandlerOpts, ListProvidersRawHandler } from './handlers/ajax/listProvidersHandler';

// -- Server meta ajax --
import { ProvidersPaginatedHandler, ProvidersPaginatedHandlerOpts } from './handlers/ajax/providersHandler';
import { SpecsPaginatedHandler, SpecsPaginatedHandlerOpts } from './handlers/ajax/specsHandler';
import { ConsumersPaginatedHandler, ConsumersPaginatedHandlerOpts } from './handlers/ajax/consumersHandler';

// -- All pages ajax --
import { AutoCompleteLinksV2PaginatedHandler, AutoCompleteLinksV2PaginatedHandlerOpts } from './handlers/ajax/autoCompleteLinksV2Handler';

// -- Index page ajax -- 
import { Index30DayCuHandlerOpts, Index30DayCuHandler } from './handlers/index/index30DayCuHandler';
import { IndexCachedMetricsHandlerOpts, IndexCachedMetricsHandler } from './handlers/index/indexCachedMetricsHandler';
import { IndexLatestBlockHandlerOpts, IndexLatestBlockHandler } from './handlers/index/indexLatestBlockHandler';
import { IndexTopChainsHandlerOpts, IndexTopChainsHandler } from './handlers/index/indexTopChainsHandler';
import { IndexTotalCuHandlerOpts, IndexTotalCuHandler } from './handlers/index/indexTotalCuHandler';
import { IndexStakesHandlerOpts, IndexStakesHandler } from './handlers/index/indexStakesHandler';

import { IndexProvidersPaginatedHandler, IndexProvidersPaginatedHandlerOpts, IndexProvidersItemCountPaginatiedHandler, IndexProvidersCSVRawHandler } from './handlers/index/indexProvidersHandler';
import { IndexProvidersActivePaginatedHandler, IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActiveItemCountPaginatiedHandler, IndexProvidersActiveCSVRawHandler } from './handlers/index/indexProvidersActiveHandler';
import { IndexChartsV3RawHandler, IndexChartsV3RawHandlerOpts } from './handlers/index/indexChartsV3Handler';

// -- Provider page ajax --
import { ProviderPaginatedHandler, ProviderPaginatedHandlerOpts } from './handlers/provider/providerHandler';
import { ProviderV2PaginatedHandler, ProviderV2PaginatedHandlerOpts } from './handlers/provider/providerV2Handler';
import { ProviderCardsDelegatorRewardsHandler, ProviderCardsDelegatorRewardsHandlerOpts } from './handlers/provider/providerCardsDelegatorRewardsHandler';
import { ProviderCardsCuRelayAndRewardsHandler, ProviderCardsCuRelayAndRewardsHandlerOpts } from './handlers/provider/providerCardsCuRelayAndRewardsHandler';
import { ProviderCardsStakesHandler, ProviderCardsStakesHandlerOpts } from './handlers/provider/providerCardsStakesHandler';
import { ProviderChartsRawHandler, ProviderChartsRawHandlerOpts } from './handlers/provider/providerChartsHandler';
import { ProviderChartsV2RawHandler, ProviderChartsV2RawHandlerOpts } from './handlers/provider/providerChartsV2Handler';
import { ProviderRelaysPerSpecPieHandler, ProviderRelaysPerSpecPieHandlerOpts } from './handlers/provider/providerRelaysPerSpecPieHandler';

import { ProviderHealthPaginatedHandler, ProviderHealthPaginatedHandlerOpts, ProviderHealthItemCountPaginatiedHandler, ProviderHealthCSVRawHandler } from './handlers/provider/providerHealthHandler';
import { ProviderErrorsPaginatedHandler, ProviderErrorsPaginatedHandlerOpts, ProviderErrorsItemCountPaginatiedHandler, ProviderErrorsCSVRawHandler } from './handlers/provider/providerErrorsHandler';
import { ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler, ProviderStakesCSVRawHandler } from './handlers/provider/providerStakesHandler';
import { ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler, ProviderEventsCSVRawHandler } from './handlers/provider/providerEventsHandler';
import { ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler, ProviderRewardsCSVRawHandler } from './handlers/provider/providerRewardsHandler';
import { ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler, ProviderReportsCSVRawHandler } from './handlers/provider/providerReportsHandler';
import { ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler, ProviderBlockReportsCSVRawHandler } from './handlers/provider/providerBlockReportsHandler';

import { ProviderHealthLatestPaginatedHandler, ProviderHealthLatestPaginatedHandlerOpts } from './handlers/provider/providerHealthLatestHandler';

// -- Events page ajax -- 
import { EventsPaginatedHandler, EventsPaginatedHandlerOpts } from './handlers/events/eventsHandler';
import { EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler, EventsEventsCSVRawHandler } from './handlers/events/eventsEventsHandler';
import { EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler, EventsRewardsCSVRawHandler } from './handlers/events/eventsRewardsHandler';
import { EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler, EventsReportsCSVRawHandler } from './handlers/events/eventsReportsHandler';

// -- Consumers page ajax -- 
import { ConsumersPageHandler, ConsumersPageHandlerOpts } from './handlers/consumerspage/consumersPageHandler';
import { ConsumersPageConsumersRawHandler, ConsumersPageConsumersRawHandlerOpts } from './handlers/consumerspage/consumersPageConsumersHandler';

// -- Consumer page ajax -- 
import { ConsumerSubscriptionItemCountPaginatiedHandler, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionRawHandlerOpts } from './handlers/consumer/consumerSubscriptionHandler';
import { ConsumerChartsRawHandler, ConsumerChartsRawHandlerOpts } from './handlers/consumer/consumerChartsHandler';
import { ConsumerEventsPaginatedHandlerOpts, ConsumerEventsPaginatedHandler, ConsumerEventsItemCountPaginatiedHandler } from './handlers/consumer/consumerEventsHandler';
import { ConsumerConflictsHandler, ConsumerConflictsHandlerOpts } from './handlers/consumer/consumerConflictsHandler';

// -- Spec page ajax --
import { SpecChartsRawHandler, SpecChartsRawHandlerOpts } from './handlers/spec/specChartsHandler';
import { SpecChartsV2RawHandler, SpecChartsV2RawHandlerOpts } from './handlers/spec/specChartsV2Handler';
import { SpecStakesPaginatedHandler, SpecStakesPaginatedHandlerOpts } from './handlers/spec/specStakesHandler';
import { SpecProviderHealthHandler, SpecProviderHealthHandlerOpts } from './handlers/spec/specProviderHealthHandler';
import {
    SpecCuRelayRewardsHandler,
    SpecCuRelayRewardsHandlerOpts,
    SpecProviderCountHandler,
    SpecProviderCountHandlerOpts,
    SpecEndpointHealthHandler,
    SpecEndpointHealthHandlerOpts,
    SpecCacheHitRateHandler,
    SpecCacheHitRateHandlerOpts,
    SpecTrackedInfoHandler,
    SpecTrackedInfoHandlerOpts
} from './handlers/spec/specV2Handlers';

// -- Internal data endpoints --
import { ConsumerV2CahcedHandler, ConsumerV2CahcedHandlerOpts } from './handlers/consumer/consumerV2Handler';
import { ChainWalletApiHandlerOpts, LavaChainRestakersHandler, LavaChainStakersHandler } from './handlers/ajax/chainWalletApiHandlers';

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

// -- Server chain wallet api ajax --
// TODO: uncomment chain wallet api to when it is available
// RegisterRedisBackedHandler('/lava_chain_stakers', ChainWalletApiHandlerOpts, LavaChainStakersHandler, { cache_ttl: 10 });
// RegisterRedisBackedHandler('/lava_chain_restakers', ChainWalletApiHandlerOpts, LavaChainRestakersHandler, { cache_ttl: 10 });

// -- Server APR ajax --
RegisterRedisBackedHandler('/apr', APRRawHandlerOpts, APRRawHandler, { cache_ttl: 60 });

// -- list all providers and monikers endpoint ---
RegisterRedisBackedHandler('/listProviders', ListProvidersRawHandlerOpts, ListProvidersRawHandler, { cache_ttl: 10 * 60 });

// -- Server meta ajax --
RegisterRedisBackedHandler('/providers', ProvidersPaginatedHandlerOpts, ProvidersPaginatedHandler, { cache_ttl: 30 });
RegisterRedisBackedHandler('/specs', SpecsPaginatedHandlerOpts, SpecsPaginatedHandler, { cache_ttl: 30 });
RegisterRedisBackedHandler('/consumers', ConsumersPaginatedHandlerOpts, ConsumersPaginatedHandler, { cache_ttl: 30 });

// -- All pages ajax --
RegisterRedisBackedHandler('/autoCompleteLinksV2Handler', AutoCompleteLinksV2PaginatedHandlerOpts, AutoCompleteLinksV2PaginatedHandler, { cache_ttl: 10 * 60 });

// -- Index page ajax -- 
RegisterRedisBackedHandler('/index30DayCu', Index30DayCuHandlerOpts, Index30DayCuHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexCachedMetrics', IndexCachedMetricsHandlerOpts, IndexCachedMetricsHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexLatestBlock', IndexLatestBlockHandlerOpts, IndexLatestBlockHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexTopChains', IndexTopChainsHandlerOpts, IndexTopChainsHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexTotalCu', IndexTotalCuHandlerOpts, IndexTotalCuHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/indexStakesHandler', IndexStakesHandlerOpts, IndexStakesHandler, { cache_ttl: 10 });
RegisterPaginationServerHandler('/indexProviders', IndexProvidersPaginatedHandlerOpts, IndexProvidersPaginatedHandler, IndexProvidersItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/indexProvidersActive', IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActivePaginatedHandler, IndexProvidersActiveItemCountPaginatiedHandler);
GetServerInstance().get('/indexProvidersCsv', IndexProvidersCSVRawHandler);
GetServerInstance().get('/indexProvidersActiveCsv', IndexProvidersActiveCSVRawHandler);
GetServerInstance().get('/indexChartsV3', IndexChartsV3RawHandlerOpts, IndexChartsV3RawHandler);

// -- Provider page ajax --
RegisterRedisBackedHandler('/provider/:addr', ProviderPaginatedHandlerOpts, ProviderPaginatedHandler);
RegisterRedisBackedHandler('/providerV2/:addr', ProviderV2PaginatedHandlerOpts, ProviderV2PaginatedHandler);
RegisterRedisBackedHandler('/providerCardsDelegatorRewards/:addr', ProviderCardsDelegatorRewardsHandlerOpts, ProviderCardsDelegatorRewardsHandler);
RegisterRedisBackedHandler('/providerCardsCuRelayAndRewards/:addr', ProviderCardsCuRelayAndRewardsHandlerOpts, ProviderCardsCuRelayAndRewardsHandler);
RegisterRedisBackedHandler('/providerCardsStakes/:addr', ProviderCardsStakesHandlerOpts, ProviderCardsStakesHandler);
GetServerInstance().get('/providerCharts/:addr', ProviderChartsRawHandlerOpts, ProviderChartsRawHandler);
GetServerInstance().get('/providerChartsV2/:specId/:addr', ProviderChartsV2RawHandlerOpts, ProviderChartsV2RawHandler);
RegisterRedisBackedHandler('/providerRelaysPerSpecPie/:addr', ProviderRelaysPerSpecPieHandlerOpts, ProviderRelaysPerSpecPieHandler);

RegisterPaginationServerHandler('/providerHealth/:addr', ProviderHealthPaginatedHandlerOpts, ProviderHealthPaginatedHandler, ProviderHealthItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerErrors/:addr', ProviderErrorsPaginatedHandlerOpts, ProviderErrorsPaginatedHandler, ProviderErrorsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerStakes/:addr', ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerEvents/:addr', ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerRewards/:addr', ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerReports/:addr', ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerBlockReports/:addr', ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler);

RegisterRedisBackedHandler('/providerLatestHealth/:addr', ProviderHealthLatestPaginatedHandlerOpts, ProviderHealthLatestPaginatedHandler, { cache_ttl: 2 * 60 });

GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVRawHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVRawHandler);
GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVRawHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVRawHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVRawHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVRawHandler);
GetServerInstance().get('/providerBlockReportsCsv/:addr', ProviderBlockReportsCSVRawHandler);

// -- Consumer page ajax --
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
GetServerInstance().get('/specStakes/:specId', SpecStakesPaginatedHandlerOpts, SpecStakesPaginatedHandler);
GetServerInstance().get('/specCharts/:specId', SpecChartsRawHandlerOpts, SpecChartsRawHandler);
GetServerInstance().get('/specChartsV2/:specId/:addr', SpecChartsV2RawHandlerOpts, SpecChartsV2RawHandler);
RegisterRedisBackedHandler('/specCuRelayRewards/:specId', SpecCuRelayRewardsHandlerOpts, SpecCuRelayRewardsHandler);
RegisterRedisBackedHandler('/specProviderCount/:specId', SpecProviderCountHandlerOpts, SpecProviderCountHandler);
RegisterRedisBackedHandler('/specEndpointHealth/:specId', SpecEndpointHealthHandlerOpts, SpecEndpointHealthHandler);
RegisterRedisBackedHandler('/specCacheHitRate/:specId', SpecCacheHitRateHandlerOpts, SpecCacheHitRateHandler);
RegisterRedisBackedHandler('/specProviderHealth/:specId/:addr', SpecProviderHealthHandlerOpts, SpecProviderHealthHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/specTrackedInfo/:specId', SpecTrackedInfoHandlerOpts, SpecTrackedInfoHandler, { cache_ttl: 10 });
