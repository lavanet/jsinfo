import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import axios from 'axios';
import { logger } from '@jsinfo/utils/logger';
import { GetEnvVar } from '@jsinfo/utils/env';

// Endpoint configuration type
interface EndpointConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers: Record<string, string>;
    body: string;
    skipTlsVerify: boolean;
    ipProtocol: string;
}

// Health check response
interface HealthCheckResult {
    endpoint: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latency: number;
    blockHeight?: number;
    error?: string;
    timestamp: string;
}

export interface NearHealthData {
    mainnet: {
        iprpc: HealthCheckResult;
        gateway: HealthCheckResult;
        overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    };
    testnet: {
        iprpc: HealthCheckResult;
        gateway: HealthCheckResult;
        overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    };
    lastUpdated: string;
    health: 'healthy' | 'degraded' | 'unhealthy';
}

export class NearHealthResource extends RedisResourceBase<NearHealthData, {}> {
    protected readonly redisKey = 'NearHealthResource_v1';
    protected readonly cacheExpirySeconds = 300; // 5 minutes cache

    // Configuration for the endpoints
    private readonly endpoints = {
        mainnet: {
            iprpc: {
                url: 'near.jsonrpc.lava.build',
                method: 'POST' as const,
                headers: {
                    'content-type': 'application/json'
                },
                body: '{"jsonrpc":"2.0","method":"block","params":{"finality":"final"},"id":1}',
                skipTlsVerify: true,
                ipProtocol: 'ip4'
            },
            gateway: {
                url: `g.w.lavanet.xyz:443/gateway/near/rpc-http/${GetEnvVar('JSINFO_NEAR_GATEWAY_HASH', 'Nc426ffd5fb1c1086f7f68f050e7d527A')}`,
                method: 'POST' as const,
                headers: {
                    'content-type': 'application/json',
                    'Authorization': `Bearer ${GetEnvVar('JSINFO_NEAR_GATEWAY_TOKEN', '-')}`
                },
                body: '{"jsonrpc":"2.0","method":"block","params":{"finality":"final"},"id":1}',
                skipTlsVerify: true,
                ipProtocol: 'ip4'
            }
        },
        testnet: {
            iprpc: {
                url: 'neart.jsonrpc.lava.build',
                method: 'POST' as const,
                headers: {
                    'content-type': 'application/json'
                },
                body: '{"jsonrpc":"2.0","method":"block","params":{"finality":"final"},"id":1}',
                skipTlsVerify: true,
                ipProtocol: 'ip4'
            },
            gateway: {
                url: `g.w.lavanet.xyz:443/gateway/neart/rpc-http/${GetEnvVar('JSINFO_NEAR_GATEWAY_HASH', 'Nc426ffd5fb1c1086f7f68f050e7d527A')}`,
                method: 'POST' as const,
                headers: {
                    'content-type': 'application/json',
                    'Authorization': `Bearer ${GetEnvVar('JSINFO_NEAR_GATEWAY_TOKEN', '-')}`
                },
                body: '{"jsonrpc":"2.0","method":"block","params":{"finality":"final"},"id":1}',
                skipTlsVerify: true,
                ipProtocol: 'ip4'
            }
        }
    };

    protected async fetchFromSource(): Promise<NearHealthData> {
        try {
            logger.info('Fetching NEAR health data');

            // Perform health checks
            const [mainnetIprpc, mainnetGateway, testnetIprpc, testnetGateway] = await Promise.all([
                this.checkEndpointHealth('mainnet', 'iprpc', this.endpoints.mainnet.iprpc),
                this.checkEndpointHealth('mainnet', 'gateway', this.endpoints.mainnet.gateway),
                this.checkEndpointHealth('testnet', 'iprpc', this.endpoints.testnet.iprpc),
                this.checkEndpointHealth('testnet', 'gateway', this.endpoints.testnet.gateway)
            ]);

            // Calculate overall health
            const allResults = [mainnetIprpc, mainnetGateway, testnetIprpc, testnetGateway];
            const healthyCount = allResults.filter(r => r.status === 'healthy').length;

            let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
            if (healthyCount === allResults.length) {
                overallHealth = 'healthy';
            } else if (healthyCount > 0) {
                overallHealth = 'degraded';
            } else {
                overallHealth = 'unhealthy';
            }

            const mainnetStatus = this.determineOverallStatus([mainnetIprpc, mainnetGateway]);
            const testnetStatus = this.determineOverallStatus([testnetIprpc, testnetGateway]);

            const healthData: NearHealthData = {
                mainnet: {
                    iprpc: mainnetIprpc,
                    gateway: mainnetGateway,
                    overallStatus: mainnetStatus
                },
                testnet: {
                    iprpc: testnetIprpc,
                    gateway: testnetGateway,
                    overallStatus: testnetStatus
                },
                lastUpdated: new Date().toISOString(),
                health: overallHealth
            };

            return healthData;
        } catch (error) {
            logger.error('Error fetching NEAR health data:', error);
            throw error;
        }
    }

    private async checkEndpointHealth(
        network: 'mainnet' | 'testnet',
        endpointType: 'iprpc' | 'gateway',
        config: EndpointConfig
    ): Promise<HealthCheckResult> {
        // Use the full URL if it already has https://, otherwise add it
        const fullUrl = config.url.startsWith('http') ? config.url : `https://${config.url}`;
        const endpointName = `${network}-${endpointType}`;

        try {
            const startTime = Date.now();

            // Make the request with proper headers and configuration
            const response = await axios({
                method: config.method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
                url: fullUrl,
                headers: config.headers,
                data: JSON.parse(config.body),
                timeout: 10000, // 10 second timeout
                httpsAgent: config.skipTlsVerify
                    ? new (require('https').Agent)({ rejectUnauthorized: false })
                    : undefined
            });

            const latency = Date.now() - startTime;

            // Process response
            if (response.status === 200 && response.data && response.data.result) {
                const blockHeight = response.data.result.header?.height || null;

                return {
                    endpoint: endpointName,
                    status: 'healthy',
                    latency,
                    blockHeight,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    endpoint: endpointName,
                    status: 'unhealthy',
                    latency,
                    error: 'Invalid response format',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            logger.warn(`Health check failed for ${endpointName}:`, error);

            return {
                endpoint: endpointName,
                status: 'unhealthy',
                latency: 0,
                error: (error as Error).message || 'Request failed',
                timestamp: new Date().toISOString()
            };
        }
    }

    private determineOverallStatus(results: HealthCheckResult[]): 'healthy' | 'degraded' | 'unhealthy' {
        const healthyCount = results.filter(r => r.status === 'healthy').length;

        if (healthyCount === results.length) {
            return 'healthy';
        } else if (healthyCount > 0) {
            return 'degraded';
        } else {
            return 'unhealthy';
        }
    }
}

export const NearHealthService = new NearHealthResource();