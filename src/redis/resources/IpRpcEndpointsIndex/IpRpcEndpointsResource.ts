import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { IpRpcEndpointsData, type ChainEndpoint } from './IpRpcEndpointsData';
import { StatsService } from './StatsService';

export class IpRpcEndpointsIndexResource extends RedisResourceBase<ChainEndpoint[], {}> {
    protected readonly redisKey = 'ip-rpc-endpoints-index-v1';
    protected readonly cacheExpirySeconds = 3600;

    protected async fetchFromSource(): Promise<ChainEndpoint[]> {
        const chainIds = IpRpcEndpointsData.map(endpoint => endpoint.chainId);
        const allStats = await StatsService.fetchAllStats(chainIds);

        return IpRpcEndpointsData.map(endpoint => ({
            ...endpoint,
            requests: {
                "24h": allStats[endpoint.chainId]["24h"].total_requests || endpoint.requests["24h"],
                "7d": allStats[endpoint.chainId]["7d"].total_requests || endpoint.requests["7d"],
                "30d": allStats[endpoint.chainId]["30d"].total_requests || endpoint.requests["30d"]
            }
        }));
    }
}

export const IpRpcEndpointsIndexService = new IpRpcEndpointsIndexResource(); 