// jsinfo/src/query/queryRoutes.ts

import { RegisterPaginationServerHandler, RegisterRedisBackedHandler, GetServerInstance } from './queryServer';
import { IsMainnet } from '@jsinfo/utils/env';
import { FastifyInstance } from 'fastify';

// =============================================================================
// IMPORTS - Grouped by functionality
// =============================================================================

// Health and Status
import { LatestRawHandler, LatestRawHandlerOpts } from './handlers/health/latestHandler';
import { IsLatestRawHandler, IsLatestRawHandlerOpts } from './handlers/health/isLatestHandler';
import { HealthRawHandler, HealthRawHandlerOpts } from './handlers/health/healthHandler';
import { HealthStatusRawHandler, HealthStatusRawHandlerOpts } from './handlers/health/healthStatusHandler';

// Supply
import { SupplyRawHandlerOpts, TotalSupplyRawHandler, CirculatingSupplyRawHandler } from './handlers/ajax/supplyHandler';
import { SupplyHistoryHandlerOpts, supplyHistoryHandler } from './handlers/ajax/supplyHistoryHandler';

// APR and Performance
import { APRRawHandlerOpts, APRRawHandler } from './handlers/apr/aprHandler';
import { APRFullHandler, APRFullHandlerOpts } from './handlers/apr/aprFullHandler';
import { ProviderPerformanceHandlerOpts, ProviderPerformanceRawHandler } from './handlers/apr/providerPerfomanceHandler';
import { GetAprWeightedHistoryHandler } from './handlers/apr/aprWeightedHandler';
import { ProvidersReputationScoresHandler, ProvidersReputationScoresHandlerOpts } from './handlers/ajax/providersReputationScoresHandler';

// Provider Data
import { ListProvidersRawHandlerOpts, ListProvidersRawHandler } from './handlers/ajax/listProvidersHandler';
import { ActiveProvidersPaginatedHandler, ActiveProvidersPaginatedHandlerOpts, ProvidersPaginatedHandler, ProvidersPaginatedHandlerOpts } from './handlers/ajax/providersHandler';
import { ProviderV2PaginatedHandler, ProviderV2PaginatedHandlerOpts } from './handlers/provider/providerV2Handler';
import { ProviderCardsDelegatorRewardsHandler, ProviderCardsDelegatorRewardsHandlerOpts } from './handlers/provider/providerCardsDelegatorRewardsHandler';
import { ProviderCardsCuRelayAndRewardsHandler, ProviderCardsCuRelayAndRewardsHandlerOpts } from './handlers/provider/providerCardsCuRelayAndRewardsHandler';
import { ProviderCardsStakesHandler, ProviderCardsStakesHandlerOpts } from './handlers/provider/providerCardsStakesHandler';
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
import { ProviderConsumerOptimizerMetricsHandler, ProviderConsumerOptimizerMetricsHandlerOpts, ProviderConsumerOptimizerMetricsQuery } from './handlers/provider/providerConsumerOptimizerMetricsHandler';
import { ProviderConsumerOptimizerMetricsFullHandler, ProviderConsumerOptimizerMetricsFullHandlerOpts } from './handlers/provider/providerConsumerOptimizerMetricsFullHandler';
import { GetProviderAvatarHandler, GetProviderAvatarHandlerOpts, ListProviderAvatarsHandler, ListProviderAvatarsHandlerOpts, ProviderAvatarParams } from './handlers/ajax/providerAvatarHandler';

// Index Page
import { Index30DayCuHandlerOpts, Index30DayCuHandler } from './handlers/index/index30DayCuHandler';
import { IndexLatestBlockHandlerOpts, IndexLatestBlockHandler } from './handlers/index/indexLatestBlockHandler';
import { IndexTopChainsHandlerOpts, IndexTopChainsHandler } from './handlers/index/indexTopChainsHandler';
import { IndexTotalCuHandlerOpts, IndexTotalCuHandler } from './handlers/index/indexTotalCuHandler';
import { IndexStakesHandlerOpts, IndexStakesHandler } from './handlers/index/indexStakesHandler';
import { IndexProvidersActivePaginatedHandler, IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActiveItemCountPaginatiedHandler, IndexProvidersActiveCSVRawHandler, IndexProvidersActiveCSVRawHandlerOpts, IndexProvidersActiveItemCountPaginatiedHandlerOpts } from './handlers/index/indexProvidersActiveHandler';
import { IndexProvidersActiveV2PaginatedHandler, IndexProvidersActiveV2PaginatedHandlerOpts, IndexProvidersActiveV2ItemCountPaginatiedHandler, IndexProvidersActiveV2CSVRawHandler, IndexProvidersActiveV2CSVRawHandlerOpts, IndexProvidersActiveV2ItemCountPaginatiedHandlerOpts, IndexProvidersActiveV2Querystring } from './handlers/index/indexProvidersActiveV2Handler';
import { IndexChartsQuerystring, IndexChartsV3RawHandler, IndexChartsV3RawHandlerOpts } from './handlers/index/indexChartsV3Handler';

// Spec Data
import { SpecsPaginatedHandler, SpecsPaginatedHandlerOpts } from './handlers/ajax/specsHandler';
import { SpecChartsV2RawHandler, SpecChartsV2RawHandlerOpts } from './handlers/spec/specChartsV2Handler';
import { SpecStakesPaginatedHandler, SpecStakesPaginatedHandlerOpts } from './handlers/spec/specStakesHandler';
import { SpecProviderHealthHandler, SpecProviderHealthHandlerOpts } from './handlers/spec/specProviderHealthHandler';
import { SpecCuRelayRewardsHandler, SpecCuRelayRewardsHandlerOpts, SpecProviderCountHandler, SpecProviderCountHandlerOpts, SpecEndpointHealthHandler, SpecEndpointHealthHandlerOpts, SpecCacheHitRateHandler, SpecCacheHitRateHandlerOpts, SpecTrackedInfoHandler, SpecTrackedInfoHandlerOpts } from './handlers/spec/specV2Handlers';
import { SpecConsumerOptimizerMetricsHandlerOpts, SpecConsumerOptimizerMetricsHandler } from './handlers/spec/specConsumerOptimizerMetricsHandler';
import { SpecConsumerOptimizerMetricsFullHandlerOpts, SpecConsumerOptimizerMetricsFullHandler } from './handlers/spec/specConsumerOptimizerMetricsFullHandler';

// Consumer Data
import { ConsumersPaginatedHandler, ConsumersPaginatedHandlerOpts } from './handlers/ajax/consumersHandler';
import { ConsumerSubscriptionItemCountPaginatiedHandler, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionRawHandlerOpts } from './handlers/consumer/consumerSubscriptionHandler';
import { ConsumerChartsRawHandler, ConsumerChartsRawHandlerOpts } from './handlers/consumer/consumerChartsHandler';
import { ConsumerEventsPaginatedHandlerOpts, ConsumerEventsPaginatedHandler, ConsumerEventsItemCountPaginatiedHandler } from './handlers/consumer/consumerEventsHandler';
import { ConsumerConflictsHandler, ConsumerConflictsHandlerOpts } from './handlers/consumer/consumerConflictsHandler';
import { ConsumerV2CahcedHandler, ConsumerV2CahcedHandlerOpts } from './handlers/consumer/consumerV2Handler';
import { ConsumersPageHandler, ConsumersPageHandlerOpts } from './handlers/consumerspage/consumersPageHandler';
import { ConsumersPageConsumersRawHandler, ConsumersPageConsumersRawHandlerOpts } from './handlers/consumerspage/consumersPageConsumersHandler';

// Events Data
import { EventsPaginatedHandler, EventsPaginatedHandlerOpts } from './handlers/events/eventsHandler';
import { EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler, EventsEventsCSVRawHandler } from './handlers/events/eventsEventsHandler';
import { EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler, EventsRewardsCSVRawHandler } from './handlers/events/eventsRewardsHandler';
import { EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler, EventsReportsCSVRawHandler } from './handlers/events/eventsReportsHandler';

// Chain Data
import { ChainWalletApiHandlerOpts, LavaChainRestakersHandler, LavaChainStakersHandler } from './handlers/ajax/chainWalletApiHandlers';
import { ActiveValidatorsPaginatedHandler, ActiveValidatorsPaginatedHandlerOpts, ValidatorsPaginatedHandler, ValidatorsPaginatedHandlerOpts } from './handlers/ajax/validatorsHandler';
import { TotalLockedValueHandler, TotalLockedValueHandlerOpts } from './handlers/ajax/totalLockedValueHandler';
import { TotalLockedValuesComponentsHandler, TotalLockedValuesComponentsHandlerOpts } from './handlers/ajax/totalLockedValuesComponentsHandler';
import { AllLockedValuesHandler, AllLockedValuesHandlerOpts } from './handlers/ajax/allLockedValuesHandler';
import { StakersAndRestakersHandler, StakersAndRestakersHandlerOpts } from './handlers/ajax/stakersAndRestakersHandler';

// IpRpc Endpoints
import { IpRpcEndpointsIndexHandler, IpRpcEndpointsIndexHandlerOpts } from './handlers/IpRpcEndpointsIndex/IpRpcEndpointsIndexHandler';

// Mainnet Only Handlers
import { MainnetProviderEstimatedRewardsHandler, MainnetProviderEstimatedRewardsHandlerOpts } from './handlers/MainnetOnlyHandlers/MainnetProviderEstimatedRewardsHandler';
import { MainnetValidatorsAndRewardsHandler, MainnetValidatorsAndRewardsHandlerOpts } from './handlers/MainnetOnlyHandlers/MainnetValidatorsAndRewardsHandler';
import { MainnetClaimableRewardsHandler, MainnetClaimableRewardsHandlerOpts } from './handlers/MainnetOnlyHandlers/MainnetClaimableRewardsHandler';

// Utility
import { AutoCompleteLinksV2PaginatedHandler, AutoCompleteLinksV2PaginatedHandlerOpts } from './handlers/ajax/autoCompleteLinksV2Handler';

// Add specStakesV2Handler routes
import { SpecStakesV2Handler, SpecStakesV2HandlerOpts } from './handlers/spec/specStakesV2Handler';

// Import the provider stakes V2 handlers at the top with your other imports
import {
    ProviderStakesV2Handler,
    ProviderStakesV2HandlerOpts,
    ProviderStakesV2CSVRawHandler,
    ProviderStakesV2CSVRawHandlerOpts
} from './handlers/provider/providerStakesV2Handler';

// Import the handler
import { NearHealthHandler, NearHealthHandlerOpts } from '@jsinfo/query/handlers/ajax/nearHealthHandler';
import { providerReputationV2Handler, ProviderReputationV2HandlerOpts } from './handlers/ajax/providerReputationV2Handler';

// Import the new handlers
import { NearMainnetHealthHandler, NearMainnetHealthHandlerOpts } from './handlers/ajax/nearMainnetHealthHandler';
import { NearTestnetHealthHandler, NearTestnetHealthHandlerOpts } from './handlers/ajax/nearTestnetHealthHandler';

// =============================================================================
// ROUTE REGISTRATION - Grouped by functionality
// =============================================================================

// -----------------------------------------------------------------------------
// Health and Status Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/latest', LatestRawHandlerOpts, LatestRawHandler);
GetServerInstance().get('/islatest', IsLatestRawHandlerOpts, IsLatestRawHandler);
GetServerInstance().get('/health', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healths', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healthz', HealthRawHandlerOpts, HealthRawHandler);
GetServerInstance().get('/healthstatus', HealthStatusRawHandlerOpts, HealthStatusRawHandler);
GetServerInstance().get('/near_health', NearHealthHandlerOpts, NearHealthHandler);
GetServerInstance().get('/near_mainnet_health', NearMainnetHealthHandlerOpts, NearMainnetHealthHandler);
GetServerInstance().get('/near_testnet_health', NearTestnetHealthHandlerOpts, NearTestnetHealthHandler);

// -----------------------------------------------------------------------------
// Supply Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/supply/total', SupplyRawHandlerOpts, TotalSupplyRawHandler);
GetServerInstance().get('/supply/circulating', SupplyRawHandlerOpts, CirculatingSupplyRawHandler);
GetServerInstance().get('/supply/history', SupplyHistoryHandlerOpts, supplyHistoryHandler);

// -----------------------------------------------------------------------------
// Chain Wallet API Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/lava_chain_stakers', ChainWalletApiHandlerOpts, LavaChainStakersHandler);
GetServerInstance().get('/lava_chain_restakers', ChainWalletApiHandlerOpts, LavaChainRestakersHandler);

// -----------------------------------------------------------------------------
// APR and Performance Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/apr', APRRawHandlerOpts, APRRawHandler);
GetServerInstance().get('/apr_full', APRFullHandlerOpts, APRFullHandler);
GetServerInstance().get('/apr_weighted', GetAprWeightedHistoryHandler);
GetServerInstance().get('/all_providers_apr', ProviderPerformanceHandlerOpts, ProviderPerformanceRawHandler);
GetServerInstance().get('/providers_performance', ProviderPerformanceHandlerOpts, ProviderPerformanceRawHandler);
GetServerInstance().get('/providers_reputation_scores', ProvidersReputationScoresHandlerOpts, ProvidersReputationScoresHandler);
GetServerInstance().get('/provider_reputation_v2', ProviderReputationV2HandlerOpts, providerReputationV2Handler);

// -----------------------------------------------------------------------------
// Provider Listing Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/listProviders', ListProvidersRawHandlerOpts, ListProvidersRawHandler);
GetServerInstance().get('/providers', ProvidersPaginatedHandlerOpts, ProvidersPaginatedHandler);
GetServerInstance().get('/active_providers', ActiveProvidersPaginatedHandlerOpts, ActiveProvidersPaginatedHandler);

// -----------------------------------------------------------------------------
// Global Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/autoCompleteLinksV2Handler', AutoCompleteLinksV2PaginatedHandlerOpts, AutoCompleteLinksV2PaginatedHandler);
GetServerInstance().get('/specs', SpecsPaginatedHandlerOpts, SpecsPaginatedHandler);
GetServerInstance().get('/consumers', ConsumersPaginatedHandlerOpts, ConsumersPaginatedHandler);
GetServerInstance().get('/validators', ValidatorsPaginatedHandlerOpts, ValidatorsPaginatedHandler);
GetServerInstance().get('/active_validators', ActiveValidatorsPaginatedHandlerOpts, ActiveValidatorsPaginatedHandler);

// -----------------------------------------------------------------------------
// Index Page Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/index30DayCu', Index30DayCuHandlerOpts, Index30DayCuHandler);
GetServerInstance().get('/indexLatestBlock', IndexLatestBlockHandlerOpts, IndexLatestBlockHandler);
GetServerInstance().get('/indexTopChains', IndexTopChainsHandlerOpts, IndexTopChainsHandler);
GetServerInstance().get('/indexTotalCu', IndexTotalCuHandlerOpts, IndexTotalCuHandler);
GetServerInstance().get('/indexStakesHandler', IndexStakesHandlerOpts, IndexStakesHandler);

GetServerInstance().get('/indexProvidersActive', IndexProvidersActivePaginatedHandlerOpts, IndexProvidersActivePaginatedHandler);
GetServerInstance().get('/item-count/indexProvidersActive', IndexProvidersActiveItemCountPaginatiedHandlerOpts, IndexProvidersActiveItemCountPaginatiedHandler);
GetServerInstance().get('/indexProvidersActiveCsv', IndexProvidersActiveCSVRawHandlerOpts, IndexProvidersActiveCSVRawHandler);

GetServerInstance().get<{ Querystring: IndexProvidersActiveV2Querystring }>(
    '/indexProvidersActiveV2',
    IndexProvidersActiveV2PaginatedHandlerOpts,
    IndexProvidersActiveV2PaginatedHandler
);
GetServerInstance().get(
    '/item-count/indexProvidersActiveV2',
    IndexProvidersActiveV2ItemCountPaginatiedHandlerOpts,
    IndexProvidersActiveV2ItemCountPaginatiedHandler
);
GetServerInstance().get(
    '/indexProvidersActiveCsvV2',
    IndexProvidersActiveCSVRawHandlerOpts,
    IndexProvidersActiveCSVRawHandler
);

GetServerInstance().get<{ Querystring: IndexChartsQuerystring }>(
    '/indexChartsV3',
    IndexChartsV3RawHandlerOpts,
    IndexChartsV3RawHandler
);

// -----------------------------------------------------------------------------
// Provider Page Routes
// -----------------------------------------------------------------------------
RegisterRedisBackedHandler('/providerV2/:addr', ProviderV2PaginatedHandlerOpts, ProviderV2PaginatedHandler);
RegisterRedisBackedHandler('/providerCardsDelegatorRewards/:addr', ProviderCardsDelegatorRewardsHandlerOpts, ProviderCardsDelegatorRewardsHandler);
RegisterRedisBackedHandler('/providerCardsCuRelayAndRewards/:addr', ProviderCardsCuRelayAndRewardsHandlerOpts, ProviderCardsCuRelayAndRewardsHandler);
RegisterRedisBackedHandler('/providerCardsStakes/:addr', ProviderCardsStakesHandlerOpts, ProviderCardsStakesHandler);
GetServerInstance().get('/providerChartsV2/:specId/:addr', ProviderChartsV2RawHandlerOpts, ProviderChartsV2RawHandler);
RegisterRedisBackedHandler('/providerRelaysPerSpecPie/:addr', ProviderRelaysPerSpecPieHandlerOpts, ProviderRelaysPerSpecPieHandler);

// Provider detailed data routes
RegisterPaginationServerHandler('/providerHealth/:addr', ProviderHealthPaginatedHandlerOpts, ProviderHealthPaginatedHandler, ProviderHealthItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerErrors/:addr', ProviderErrorsPaginatedHandlerOpts, ProviderErrorsPaginatedHandler, ProviderErrorsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerStakes/:addr', ProviderStakesPaginatedHandlerOpts, ProviderStakesHandler, ProviderStakesItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerEvents/:addr', ProviderEventsPaginatedHandlerOpts, ProviderEventsPaginatedHandler, ProviderEventsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerRewards/:addr', ProviderRewardsPaginatedHandlerOpts, ProviderRewardsPaginatedHandler, ProviderRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerReports/:addr', ProviderReportsPaginatedHandlerOpts, ProviderReportsPaginatedHandler, ProviderReportsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/providerBlockReports/:addr', ProviderBlockReportsPaginatedHandlerOpts, ProviderBlockReportsPaginatedHandler, ProviderBlockReportsItemCountPaginatiedHandler);
RegisterRedisBackedHandler('/providerLatestHealth/:addr', ProviderHealthLatestPaginatedHandlerOpts, ProviderHealthLatestPaginatedHandler, { cache_ttl: 2 * 60 });

// Provider CSV export routes
GetServerInstance().get('/providerHealthCsv/:addr', ProviderHealthCSVRawHandler);
GetServerInstance().get('/providerErrorsCsv/:addr', ProviderErrorsCSVRawHandler);
GetServerInstance().get('/providerStakesCsv/:addr', ProviderStakesCSVRawHandler);
GetServerInstance().get('/providerEventsCsv/:addr', ProviderEventsCSVRawHandler);
GetServerInstance().get('/providerRewardsCsv/:addr', ProviderRewardsCSVRawHandler);
GetServerInstance().get('/providerReportsCsv/:addr', ProviderReportsCSVRawHandler);
GetServerInstance().get('/providerBlockReportsCsv/:addr', ProviderBlockReportsCSVRawHandler);

// Provider optimizer metrics routes
GetServerInstance().get<{ Querystring: ProviderConsumerOptimizerMetricsQuery }>(
    '/providerConsumerOptimizerMetrics/:addr',
    ProviderConsumerOptimizerMetricsHandlerOpts,
    ProviderConsumerOptimizerMetricsHandler
);
GetServerInstance().get(
    '/providerConsumerOptimizerMetricsFull/:addr',
    ProviderConsumerOptimizerMetricsFullHandlerOpts,
    ProviderConsumerOptimizerMetricsFullHandler
);

// Provider avatar routes
GetServerInstance().get<ProviderAvatarParams>('/provider_avatar/:providerId', GetProviderAvatarHandlerOpts, GetProviderAvatarHandler);
GetServerInstance().get('/provider_avatars', ListProviderAvatarsHandlerOpts, ListProviderAvatarsHandler);

// -----------------------------------------------------------------------------
// Consumer Page Routes
// -----------------------------------------------------------------------------
RegisterRedisBackedHandler('/consumerV2/:addr', ConsumerV2CahcedHandlerOpts, ConsumerV2CahcedHandler);
RegisterPaginationServerHandler('/consumerSubscriptions/:addr', ConsumerSubscriptionRawHandlerOpts, ConsumerSubscriptionPaginatedRawHandler, ConsumerSubscriptionItemCountPaginatiedHandler);
RegisterRedisBackedHandler('/consumerConflicts/:addr', ConsumerConflictsHandlerOpts, ConsumerConflictsHandler, { cache_ttl: 10 });
GetServerInstance().get('/consumerCharts/:addr', ConsumerChartsRawHandlerOpts, ConsumerChartsRawHandler);
RegisterPaginationServerHandler('/consumerEvents/:addr', ConsumerEventsPaginatedHandlerOpts, ConsumerEventsPaginatedHandler, ConsumerEventsItemCountPaginatiedHandler);

// -----------------------------------------------------------------------------
// Consumers Page Routes
// -----------------------------------------------------------------------------
RegisterRedisBackedHandler('/consumerspage', ConsumersPageHandlerOpts, ConsumersPageHandler, { cache_ttl: 60 });
RegisterRedisBackedHandler('/consumerspageConsumers', ConsumersPageConsumersRawHandlerOpts, ConsumersPageConsumersRawHandler, { cache_ttl: 60 });

// -----------------------------------------------------------------------------
// Events Page Routes
// -----------------------------------------------------------------------------
RegisterRedisBackedHandler('/events', EventsPaginatedHandlerOpts, EventsPaginatedHandler, { cache_ttl: 20 });
RegisterPaginationServerHandler('/eventsEvents', EventsEventsPaginatedHandlerOpts, EventsEventsPaginatedHandler, EventsEventsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/eventsRewards', EventsRewardsPaginatedHandlerOpts, EventsRewardsPaginatedHandler, EventsRewardsItemCountPaginatiedHandler);
RegisterPaginationServerHandler('/eventsReports', EventsReportsPaginatedHandlerOpts, EventsReportsPaginatedHandler, EventsReportsItemCountPaginatiedHandler);

// Events CSV export routes
GetServerInstance().get('/eventsEventsCsv', EventsEventsCSVRawHandler);
GetServerInstance().get('/eventsRewardsCsv', EventsRewardsCSVRawHandler);
GetServerInstance().get('/eventsReportsCsv', EventsReportsCSVRawHandler);

// -----------------------------------------------------------------------------
// Spec Page Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/specStakes/:specId', SpecStakesPaginatedHandlerOpts, SpecStakesPaginatedHandler);
GetServerInstance().get('/specChartsV2/:specId/:addr', SpecChartsV2RawHandlerOpts, SpecChartsV2RawHandler);
RegisterRedisBackedHandler('/specCuRelayRewards/:specId', SpecCuRelayRewardsHandlerOpts, SpecCuRelayRewardsHandler);
RegisterRedisBackedHandler('/specProviderCount/:specId', SpecProviderCountHandlerOpts, SpecProviderCountHandler);
RegisterRedisBackedHandler('/specEndpointHealth/:specId', SpecEndpointHealthHandlerOpts, SpecEndpointHealthHandler);
RegisterRedisBackedHandler('/specCacheHitRate/:specId', SpecCacheHitRateHandlerOpts, SpecCacheHitRateHandler);
RegisterRedisBackedHandler('/specProviderHealth/:specId/:addr', SpecProviderHealthHandlerOpts, SpecProviderHealthHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/specTrackedInfo/:specId', SpecTrackedInfoHandlerOpts, SpecTrackedInfoHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/specConsumerOptimizerMetrics/:specId', SpecConsumerOptimizerMetricsHandlerOpts, SpecConsumerOptimizerMetricsHandler, { cache_ttl: 10 });
RegisterRedisBackedHandler('/specConsumerOptimizerMetricsFull/:specId', SpecConsumerOptimizerMetricsFullHandlerOpts, SpecConsumerOptimizerMetricsFullHandler, { cache_ttl: 10 });

// Add specStakesV2Handler routes
GetServerInstance().get('/specStakesV2/:specId', SpecStakesV2HandlerOpts, SpecStakesV2Handler);

// -----------------------------------------------------------------------------
// Total Value Locked Routes
// -----------------------------------------------------------------------------
const tvlRoutes = [
    '/total_value_locked',
    '/total_locked_value',
    '/tvl',
    '/tlv'
];

tvlRoutes.forEach(route => {
    GetServerInstance().get(route, TotalLockedValueHandlerOpts, TotalLockedValueHandler);
});

const tvlComponentsRoutes = [
    '/total_value_locked_components',
    '/total_locked_value_components',
    '/tvl_components',
    '/tlv_components'
];

tvlComponentsRoutes.forEach(route => {
    GetServerInstance().get(route, TotalLockedValuesComponentsHandlerOpts, TotalLockedValuesComponentsHandler);
});

GetServerInstance().get("/all_locked_values", AllLockedValuesHandlerOpts, AllLockedValuesHandler);

RegisterRedisBackedHandler('/stakers_and_restakers', StakersAndRestakersHandlerOpts, StakersAndRestakersHandler, { cache_ttl: 30 });

// -----------------------------------------------------------------------------
// IP RPC Endpoints Routes
// -----------------------------------------------------------------------------
GetServerInstance().get('/lava_iprpc_endpoints', IpRpcEndpointsIndexHandlerOpts, IpRpcEndpointsIndexHandler);

// -----------------------------------------------------------------------------
// Mainnet-only Routes
// -----------------------------------------------------------------------------
if (IsMainnet()) {
    GetServerInstance().get('/lava_mainnet_provider_estimated_rewards', MainnetProviderEstimatedRewardsHandlerOpts, MainnetProviderEstimatedRewardsHandler);
    GetServerInstance().get('/lava_mainnet_validators_and_rewards', MainnetValidatorsAndRewardsHandlerOpts, MainnetValidatorsAndRewardsHandler);
    GetServerInstance().get('/lava_mainnet_provider_claimable_rewards', MainnetClaimableRewardsHandlerOpts, MainnetClaimableRewardsHandler);
}

// Add route registrations for the new handlers
GetServerInstance().get('/providerStakesV2/:addr', ProviderStakesV2HandlerOpts, ProviderStakesV2Handler);
GetServerInstance().get('/providerStakesV2Csv/:addr', ProviderStakesV2CSVRawHandlerOpts, ProviderStakesV2CSVRawHandler);
