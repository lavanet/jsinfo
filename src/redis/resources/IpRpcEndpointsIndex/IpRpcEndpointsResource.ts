import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IpRpcEndpointsData, type ChainEndpoint, HealthStatus } from './IpRpcEndpointsData';
import { StatsService } from './StatsService';
import axios from 'axios';
import { logger } from '@jsinfo/utils/logger';
import { GetEnvVar } from '@jsinfo/utils/env';
import { ProviderStakesAndDelegationService } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource'

export function GeoLocationToString(geo: number) {
    if (geo == 0) {
        return "Global-strict";
    }
    if (geo == 0xffff) {
        return "Global";
    }

    let geos: string[] = [];
    if (geo & 0x1) {
        geos.push("US-Center");
    }
    if (geo & 0x2) {
        geos.push("Europe");
    }
    if (geo & 0x4) {
        geos.push("US-East");
    }
    if (geo & 0x8) {
        geos.push("US-West");
    }
    if (geo & 0x10) {
        geos.push("Africa");
    }
    if (geo & 0x20) {
        geos.push("Asia");
    }
    if (geo & 0x40) {
        geos.push("Australia & New-Zealand");
    }
    return geos.join(",");
}

interface ProviderStats {
    activeProviders: number;
    totalProviders: number;
    geolocations: string[];
    totalRewardsUSD: number;
    totalRewardsLAVA: number;
    totalStake: number;
    features: string[];
}

export class IpRpcEndpointsIndexResource extends RedisResourceBase<ChainEndpoint[], {}> {
    protected readonly redisKey = 'ip-rpc-endpoints-index-v1';
    protected readonly cacheExpirySeconds = 300; // Reduce to 5 minutes since we're checking health

    private readonly chainIdToSpecId: Record<string, string> = {
        'lava': 'LAVA',
        'cosmoshub': 'COSMOSHUB',
        'near': 'NEAR',
        'neart': 'NEART',
        'evmos': 'EVMOS',
        'evmost': 'EVMOST',
        'strgz': 'STRGZ',
        'strgzt': 'STRGZT',
        'axelar': 'AXELAR',
        'axelart': 'AXELART',
        'arb1': 'ARBITRUM',
        'arbn': 'ARBITRUMS',
        'arbs': 'ARBITRUMS',
        'eth1': 'ETH1',
        'osmosis': 'OSMOSIS',
        'osmosist': 'OSMOSIST',
        'celestia': 'CELESTIA',
        'celestiatm': 'CELESTIATM',
        'base': 'BASE',
        'bsc': 'BSC',
        'solana': 'SOLANA',
        'sep1': 'SEP1',
        'strk': 'STRK',
        'strks': 'STRKS',
        'apt1': 'APT1',
        'fvm': 'FVM',
        'fvmt': 'FVMT',
        'blast': 'BLAST',
        'avax': 'AVAX',
        'polygon': 'POLYGON'
    };

    private getGeolocationsFromNumber(geo: number): string[] {
        if (geo === undefined || geo === null) {
            logger.debug("Received undefined/null geolocation");
            return [];
        }

        // logger.debug(`Converting geolocation number: ${geo}`);

        if (geo === 0) {
            return ["Global-strict"];
        }
        if (geo === 0xffff) {
            return ["Global"];
        }

        const geos: string[] = [];
        if (geo & 0x1) geos.push("US-Center");
        if (geo & 0x2) geos.push("Europe");
        if (geo & 0x4) geos.push("US-East");
        if (geo & 0x8) geos.push("US-West");
        if (geo & 0x10) geos.push("Africa");
        if (geo & 0x20) geos.push("Asia");
        if (geo & 0x40) geos.push("Australia & New-Zealand");

        // logger.debug(`Converted ${geo} to geolocations:`, geos);
        return geos;
    }

    private async getProviderStats(chainId: string): Promise<ProviderStats> {
        const providerData = await ProviderStakesAndDelegationService.fetch();
        const specId = this.chainIdToSpecId[chainId] || chainId.toUpperCase();

        // Get providers for this chain
        const chainProviders = providerData?.detailedSpecStakes?.[specId] || [];

        let activeProviders = 0;
        let totalRewardsUSD = 0;
        let totalRewardsLAVA = 0;
        let totalStake = 0;
        const geoSet = new Set<string>();
        const featureSet = new Set<string>();

        // Process each provider
        for (const provider of chainProviders) {
            // Count active providers
            if (provider.statusString.toLowerCase().trim() === "active") {
                activeProviders++;
            }

            // Add geolocation
            if (provider.geolocation !== undefined) {
                const geoStrings = this.getGeolocationsFromNumber(provider.geolocation);
                geoStrings.forEach(geo => geoSet.add(geo));
            }

            // Add features
            if (provider.addons) {
                const addonFeatures = provider.addons.split(',')
                    .map(f => f.trim())
                    .filter(f => f && f !== '-'); // Skip empty and '-' values
                addonFeatures.forEach(feature => featureSet.add(feature));
            }
            if (provider.extensions) {
                const extensionFeatures = provider.extensions.split(',')
                    .map(f => f.trim())
                    .filter(f => f && f !== '-'); // Skip empty and '-' values
                extensionFeatures.forEach(feature => featureSet.add(feature));
            }

            // Sum rewards and stake
            if (provider.rewards && typeof provider.rewards !== 'string') {
                totalRewardsUSD += parseFloat(provider.rewards.usd) || 0;
                totalRewardsLAVA += parseFloat(provider.rewards.lava) || 0;
            }
            totalStake += parseInt(provider.totalStake) || 0;
        }

        return {
            activeProviders,
            totalProviders: chainProviders.length,
            geolocations: Array.from(geoSet),
            totalRewardsUSD,
            totalRewardsLAVA,
            totalStake,
            features: Array.from(featureSet).filter(f => f !== '-')
        };
    }

    private async checkEndpointHealth(endpoint: ChainEndpoint): Promise<HealthStatus> {
        const startTime = Date.now();
        const config = endpoint.healthCheck;

        if (!config) {
            return {
                status: 'unhealthy',
                latency: 0,
                error: 'No health check configuration',
                timestamp: new Date().toISOString()
            };
        }

        try {
            let url: string;
            if (endpoint.apiEndpoints.rest?.[0]) {
                url = endpoint.apiEndpoints.rest[0];
                if (config.endpoint) {
                    url = `${url}${config.endpoint}`;
                }
            } else {
                logger.warn(`No REST endpoint found for ${endpoint.chainId}`);
                return {
                    status: 'unhealthy',
                    latency: 0,
                    error: 'No REST endpoint configured',
                    timestamp: new Date().toISOString()
                };
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GetEnvVar('JSINFO_GATEWAY_TOKEN', '-')}`
            };

            const response = await axios({
                method: config.method,
                url,
                headers,
                data: config.method === 'POST' ? {
                    jsonrpc: '2.0',
                    method: config.jsonRpcMethod,
                    params: config.jsonRpcParams || [],
                    id: 1
                } : undefined,
                timeout: 10000
            });

            const latency = Date.now() - startTime;

            // Extract block height using the response validation path
            let blockHeight: number | string | undefined;
            if (config.responseValidation) {
                let value = response.data;
                for (const key of config.responseValidation.path) {
                    value = value[key];
                }
                blockHeight = value;
            }

            logger.debug(`Health check for ${endpoint.chainId}:`, {
                latency,
                blockHeight,
                status: 'healthy'
            });

            return {
                status: 'healthy',
                latency,
                blockHeight,
                timestamp: new Date().toISOString()
            };

        } catch (error: any) {
            const latency = Date.now() - startTime;
            logger.warn(`Health check failed for ${endpoint.chainId}:`, error);

            return {
                status: 'unhealthy',
                latency,
                error: error.message || 'Request failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    protected async fetchFromSource(): Promise<ChainEndpoint[]> {
        const chainIds = IpRpcEndpointsData.map(endpoint => endpoint.chainId);
        const [allStats, healthChecks, providerStats] = await Promise.all([
            StatsService.fetchAllStats(chainIds),
            Promise.all(IpRpcEndpointsData.map(endpoint => this.checkEndpointHealth(endpoint))),
            Promise.all(chainIds.map(chainId => this.getProviderStats(chainId)))
        ]);

        return IpRpcEndpointsData.map((endpoint, index) => ({
            ...endpoint,
            requests: {
                "24h": allStats[endpoint.chainId]["24h"].total_requests || endpoint.requests["24h"],
                "7d": allStats[endpoint.chainId]["7d"].total_requests || endpoint.requests["7d"],
                "30d": allStats[endpoint.chainId]["30d"].total_requests || endpoint.requests["30d"]
            },
            health: healthChecks[index],
            providerStats: providerStats[index],
            features: undefined // Remove from top level since it's now in providerStats
        }));
    }
}

export const IpRpcEndpointsIndexService = new IpRpcEndpointsIndexResource();

export class IpRpcEndpointsIndexWithHealthResource extends RedisResourceBase<ChainEndpoint[], {}> {
    protected readonly redisKey = 'ip-rpc-endpoints-index-health-v2';
    protected readonly cacheExpirySeconds = 181; // 3 minutes . 30 seconds is 2 little

    protected async fetchFromSource(): Promise<ChainEndpoint[]> {
        const baseData = await IpRpcEndpointsIndexService.fetch();

        if (!baseData) {
            return [];
        }

        // Update only health checks but keep the healthCheck config
        const healthChecks = await Promise.all(
            baseData.map(endpoint => IpRpcEndpointsIndexService['checkEndpointHealth'](endpoint))
        );

        // Make sure we preserve the healthCheck configuration in the response
        return baseData.map((endpoint, index) => ({
            ...endpoint,
            healthCheck: endpoint.healthCheck, // Explicitly include the healthCheck config
            health: healthChecks[index]
        }));
    }
}

export const IpRpcEndpointsIndexWithHealthService = new IpRpcEndpointsIndexWithHealthResource(); 