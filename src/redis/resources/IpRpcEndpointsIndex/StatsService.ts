import axios from "axios";
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { IpRpcEndpointsData } from './IpRpcEndpointsData';

export interface StatsResponse {
    archive_requests: number;
    avg_latency: number;
    avg_requests_per_sec: number;
    bytes_served: number;
    cached_requests: number;
    current_latency: number;
    current_requests_per_sec: number;
    end_date: string;
    node_error_count: number;
    start_date: string;
    total_requests: number;
    unique_dapps: number;
    unique_users: number;
    network?: 'mainnet' | 'testnet' | 'unknown';
}

type StatsPeriod = '24h' | '7d' | '30d';

export class StatsService {
    private static readonly CACHE_DURATION = 24 * 60 * 60;
    private static readonly REFETCH_INTERVAL = 60 * 60;
    private static readonly STATS_API_URL = 'https://cf-logpush.lavapro.xyz/stats';

    private static async fetchStats(chainId: string, period: string): Promise<StatsResponse> {
        try {
            const url = `${this.STATS_API_URL}?chain_id=${chainId}&time_range=${period}`;
            const response = await axios.get<StatsResponse>(url, {
                timeout: 30000,
                headers: { 'Accept': 'application/json' }
            });

            return response.data?.total_requests ? response.data : this.getDefaultStats();
        } catch (error) {
            console.error(`[StatsService] Error fetching ${chainId}/${period}:`, error);
            return this.getDefaultStats();
        }
    }

    public static async fetchAllStats(chainIds: string[]): Promise<Record<string, Record<StatsPeriod, StatsResponse>>> {
        // console.log(`[StatsService] Fetching stats for ${chainIds.length} chains`);
        const results: Record<string, Record<StatsPeriod, StatsResponse>> = {};
        const periods: StatsPeriod[] = ['24h', '7d', '30d'];

        await Promise.all(chainIds.map(async chainId => {
            results[chainId] = {} as Record<StatsPeriod, StatsResponse>;

            await Promise.all(periods.map(async period => {
                const cacheKey = `stats:${chainId}:${period}`;
                const cached = await RedisCache.getDict(cacheKey) as StatsResponse;
                const ttl = await RedisCache.getTTL(cacheKey);
                const shouldRefetch = ttl && (this.CACHE_DURATION - ttl) >= this.REFETCH_INTERVAL;

                // console.log(`[StatsService] ${chainId}/${period}:`, {
                //     cached: cached?.total_requests > 0 ? '✅' : '❌',
                //     ttl: ttl || 'none',
                //     shouldRefetch: shouldRefetch ? '🔄' : '✋'
                // });

                if (cached && cached.total_requests > 0 && !shouldRefetch) {
                    // console.log(`[StatsService] Using cache for ${chainId}/${period}: ${cached.total_requests} requests`);
                    results[chainId][period] = cached;
                    return;
                }

                const stats = await this.fetchStats(chainId, period);
                if (stats.total_requests > 0) {
                    // console.log(`[StatsService] New data for ${chainId}/${period}: ${stats.total_requests} requests`);
                    await RedisCache.setDict(cacheKey, stats, this.CACHE_DURATION);
                    results[chainId][period] = stats;
                } else {
                    const originalData = IpRpcEndpointsData.find(e => e.chainId === chainId);
                    const fallbackRequests = originalData?.requests[period] || 0;
                    // console.log(`[StatsService] Using fallback for ${chainId}/${period}: ${fallbackRequests} requests`);
                    results[chainId][period] = {
                        ...this.getDefaultStats(),
                        total_requests: fallbackRequests
                    };
                }
            }));
        }));

        // console.log('[StatsService] Fetch completed');
        return results;
    }

    private static getDefaultStats(): StatsResponse {
        return {
            archive_requests: 0,
            avg_latency: 0,
            avg_requests_per_sec: 0,
            bytes_served: 0,
            cached_requests: 0,
            current_latency: 0,
            current_requests_per_sec: 0,
            end_date: new Date().toISOString(),
            node_error_count: 0,
            start_date: new Date().toISOString(),
            total_requests: 0,
            unique_dapps: 0,
            unique_users: 0
        };
    }
} 