import axios from "axios";

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

interface TimingInfo {
    chainId: string;
    period: StatsPeriod;
    duration: number;
}

interface StatsResponseWithTiming extends StatsResponse {
    _timing?: TimingInfo;
}

interface CacheEntry {
    data: StatsResponse;
    timestamp: number;
}

type StatsPeriod = '24h' | '7d' | '30d';

interface ChainStats {
    [chainId: string]: {
        [K in StatsPeriod]?: CacheEntry;
    };
}

export class StatsService {
    private static statsCache: ChainStats = {};
    private static readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
    private static readonly STATS_API_URL = 'https://cf-logpush.lavapro.xyz/stats';

    private static async fetchStatsWithTiming(chainId: string, period: StatsPeriod): Promise<StatsResponseWithTiming> {
        const start = Date.now();

        chainId = chainId.toLowerCase();
        // Check cache first
        const cacheEntry = this.statsCache[chainId]?.[period];
        const now = Date.now();

        if (cacheEntry && (now - cacheEntry.timestamp) < this.CACHE_DURATION) {
            return {
                ...cacheEntry.data,
                _timing: { chainId, period, duration: Date.now() - start }
            };
        }

        const result = await this.fetchStats(chainId, period);
        const duration = Date.now() - start;

        // Cache the result
        if (!this.statsCache[chainId]) {
            this.statsCache[chainId] = {};
        }
        this.statsCache[chainId][period] = {
            data: result,
            timestamp: now
        };

        return { ...result, _timing: { chainId, period, duration } };
    }

    public static async fetchStats(chainId: string, period: string): Promise<StatsResponse> {
        try {
            // Use correct URL format with query parameters
            const url = `${this.STATS_API_URL}?chain_id=${chainId}&time_range=${period}`;
            console.log(`[StatsService] Fetching stats from: ${url}`);

            const response = await axios.get<StatsResponse>(url, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.data) {
                throw new Error('Empty response');
            }

            console.log(`[StatsService] Response for ${chainId}/${period}:`, response.data);
            return response.data;
        } catch (error) {
            console.error(`[StatsService] Error fetching stats for ${chainId}/${period}:`, error);
            return this.getDefaultStats();
        }
    }

    public static async fetchAllStats(chainIds: string[]): Promise<{ [key: string]: { [K in StatsPeriod]: StatsResponse } }> {
        const start = Date.now();
        console.log(`[StatsService] Starting parallel fetch for ${chainIds.length} chains`);

        // Normalize chain IDs to lowercase
        const normalizedChainIds = chainIds.map(id => id.toLowerCase());

        // Create all tasks and execute them immediately
        const fetchPromises = normalizedChainIds.flatMap(chainId =>
            ['24h', '7d', '30d'].map(period =>
                this.fetchStatsWithTiming(chainId, period as StatsPeriod)
                    .then(result => {
                        console.log(`[StatsService] Fetched ${chainId}/${period}`);
                        return {
                            ...result,
                            _timing: {
                                chainId: chainIds[normalizedChainIds.indexOf(chainId)], // Use original case
                                period: period as StatsPeriod,
                                duration: result._timing?.duration || 0
                            }
                        };
                    })
                    .catch(error => {
                        console.error(`[StatsService] Failed ${chainId}/${period}:`, error);
                        return {
                            ...this.getDefaultStats(),
                            _timing: {
                                chainId: chainIds[normalizedChainIds.indexOf(chainId)], // Use original case
                                period: period as StatsPeriod,
                                duration: 0
                            }
                        };
                    })
            )
        );

        // Wait for all requests to complete
        const results = await Promise.all(fetchPromises);

        // Group results
        const groupedResults = results.reduce((acc, result) => {
            const { chainId, period } = result._timing!;
            if (!acc[chainId]) {
                acc[chainId] = {
                    '24h': this.getDefaultStats(),
                    '7d': this.getDefaultStats(),
                    '30d': this.getDefaultStats()
                };
            }
            acc[chainId][period] = result;
            return acc;
        }, {} as { [key: string]: { [K in StatsPeriod]: StatsResponse } });

        const duration = Date.now() - start;
        console.log(`[StatsService] All fetches completed in ${duration}ms`);

        return groupedResults;
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
            unique_users: 0,
            network: 'unknown'
        };
    }
} 