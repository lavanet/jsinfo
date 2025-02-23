import { logger } from '@jsinfo/utils/logger';
import { ProcessTokenArrayAtTime, ProcessedTokenWithSource, getCoingeckoPricesResolvedMap } from '@jsinfo/redis/resources/APR/ProcessLavaRpcTokenArray';
import { MainnetGetEstimatedProviderRewardsNoAmountNoDenom } from '@jsinfo/restRpc/MainnetLavaRpcEndpointCache';
import { FetchRestData } from '@jsinfo/restRpc/RestFetch';
import { ProcessedToken } from '@jsinfo/redis/resources/APR/ProcessLavaRpcTokenArray';

const MAINNET_INFO_URL = 'https://jsinfo.mainnet.lavanet.xyz/latest';
const MAINNET_ACTIVE_PROVIDERS_URL = 'https://jsinfo.mainnet.lavanet.xyz/active_providers';
const FETCH_TIMEOUT = 120000; // 120 seconds


export interface MainnetLatestBlock {
    height: number;
    datetime: number;
}

export interface MainnetActiveProvidersResponse {
    providers: string[];
}

export interface ProcessedRewardsData {
    rewards_by_block: {
        [block: string]: {
            info: ProcessedToken[];
            total: {
                tokens: ProcessedToken[];
                total_usd: number;
            };
        };
    };
    coingecko_prices: {
        tokens: CoinGeckoPriceInfo[];
    };
    date: string;
}

export interface BlockMetadata {
    height: number;
    time: string;
    seconds_off: number;
    date: string;
}

export interface CoinGeckoPriceInfo {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    value_usd: string;
}

export interface ProviderRewardsData {
    providers: Array<{
        address: string;
        rewards_by_block: {
            latest: {
                info: ProcessedTokenWithSource[];
                total: {
                    tokens: ProcessedToken[];
                    total_usd: number;
                };
                recommended_block: string;
            };
        };
    }>;
    timestamp: string;
    total_providers: number;
    providers_with_rewards: number;
    metadata: {
        generated_at: string;
        block_info: BlockMetadata | null;
        coingecko_prices: {
            tokens: CoinGeckoPriceInfo[];
        };
    };
}

async function getMainnetLatestBlock(): Promise<MainnetLatestBlock> {
    try {
        return await FetchRestData<MainnetLatestBlock>(MAINNET_INFO_URL, { timeout: FETCH_TIMEOUT });
    } catch (error) {
        logger.error('Error fetching mainnet latest block:', error);
        return {
            height: 0,
            datetime: Date.now()
        };
    }
}

async function getActiveProviders(): Promise<string[]> {
    try {
        const response = await FetchRestData<MainnetActiveProvidersResponse>(
            MAINNET_ACTIVE_PROVIDERS_URL,
            { timeout: FETCH_TIMEOUT }
        );
        return response.providers;
    } catch (error) {
        logger.error('Error fetching active providers:', error);
        return [];
    }
}

export async function GenLavaLatestProviderRewards(): Promise<ProviderRewardsData> {
    const now = new Date();
    const latestBlock = await getMainnetLatestBlock();
    const blockTime = new Date(latestBlock.datetime);
    const providers = await getActiveProviders();
    logger.info(`Processing ${providers.length} providers`);

    const providersData: Array<{
        address: string;
        rewards_by_block: {
            latest: {
                info: ProcessedTokenWithSource[];
                total: {
                    tokens: ProcessedToken[];
                    total_usd: number;
                };
                recommended_block: string;
            };
        };
    }> = [];
    for (const provider of providers) {
        try {
            const response = await MainnetGetEstimatedProviderRewardsNoAmountNoDenom(provider);

            const processed = await ProcessTokenArrayAtTime(response, null);

            providersData.push({
                address: provider,
                rewards_by_block: {
                    latest: {
                        info: processed.info || [],
                        total: processed.total || {
                            tokens: [],
                            total_usd: 0
                        },
                        recommended_block: response.recommended_block?.toString() || "0"
                    }
                }
            });
        } catch (error) {
            throw new Error(`Failed to process provider ${provider}: ${error}`);
        }
    }

    if (providersData.length === 0) {
        throw new Error('No provider data was processed successfully');
    }

    const coingeckoPrices = getCoingeckoPricesResolvedMap(null);

    return {
        providers: providersData,
        timestamp: now.toISOString().slice(0, 10).replace(/-/g, '_'),
        total_providers: providers.length,
        providers_with_rewards: providersData.length,
        metadata: {
            generated_at: now.toISOString(),
            block_info: {
                height: latestBlock.height,
                time: blockTime.toISOString(),
                seconds_off: 0,
                date: blockTime.toISOString().split('T')[0]
            },
            coingecko_prices: {
                tokens: Object.values(coingeckoPrices)
            }
        }
    };
}