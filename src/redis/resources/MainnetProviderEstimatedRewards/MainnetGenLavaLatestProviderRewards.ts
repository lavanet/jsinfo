import { logger } from '@jsinfo/utils/logger';
import { processTokenArrayAtTime, getCoingeckoPricesResolvedMap } from '@jsinfo/restRpc/ProcessLavaRpcTokenArray';
import { MainnetGetEstimatedProviderRewardsNoAmountNoDenom } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { FetchRestData } from '@jsinfo/restRpc/fetch';

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

export interface TokenInfo {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    resolved_amount: string;
    value_usd: string;
}

export interface CoinGeckoPrice {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    price: number;
}

export interface ProcessedInfoItem {
    source: string;
    amount: {
        tokens: TokenInfo[];
        total_usd: number;
    };
}

export interface ProcessedRewardsData {
    rewards_by_block: {
        [block: string]: {
            info: ProcessedInfoItem[];
            total: {
                tokens: TokenInfo[];
                total_usd: number;
            };
        };
    };
    coingecko_prices: {
        tokens: CoinGeckoPrice[];
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
    price: number;
}

export interface ProviderRewardsData {
    providers: Array<{
        address: string;
        rewards_by_block: {
            latest: {
                info: ProcessedInfoItem[];
                total: {
                    tokens: Array<{
                        amount: string;
                        denom: string;
                        original_denom: string;
                        value_usd: string;
                    }>;
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
        coingecko_prices: Record<string, CoinGeckoPriceInfo>;
    };
}

interface BlockData {
    info?: Array<{
        source: string;
        amount: {
            tokens: Array<{
                source_denom: string;
                resolved_denom: string;
                display_denom: string;
                display_amount: string;
                resolved_amount: string;
                value_usd: string;
            }>;
            total_usd: number;
        };
    }>;
    total?: {
        tokens: TokenInfo[];
        total_usd: number;
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
    const providersData: Array<{
        address: string;
        rewards_by_block: {
            latest: {
                info: ProcessedInfoItem[];
                total: {
                    tokens: Array<{
                        amount: string;
                        denom: string;
                        original_denom: string;
                        value_usd: string;
                    }>;
                    total_usd: number;
                };
                recommended_block: string;
            };
        };
    }> = [];
    const timestamp = null;

    for (const provider of providers) {
        try {
            const response = await MainnetGetEstimatedProviderRewardsNoAmountNoDenom(provider);
            // logger.debug(`Provider ${provider} response:`, response);

            const processed = await processTokenArrayAtTime(response.total || [], timestamp);
            // logger.debug(`Processed rewards for ${provider}:`, processed);

            // Check if there are any tokens with value
            const hasTokens = processed.tokens.length > 0;
            // logger.debug(`Provider ${provider} has tokens: ${hasTokens}, token count: ${processed.tokens.length}`);

            if (hasTokens) {
                // Get recommended block directly from response
                const recommendedBlock = response.recommended_block?.toString() || "0";
                // logger.debug(`Provider ${provider} recommended block:`, recommendedBlock);

                providersData.push({
                    address: provider,
                    rewards_by_block: {
                        latest: {
                            info: processed.info || [],
                            total: {
                                tokens: processed.tokens,
                                total_usd: processed.total_usd
                            },
                            recommended_block: recommendedBlock // Use the extracted value
                        }
                    }
                });

                // logger.debug(`Added provider to providersData:`, {
                //     provider,
                //     currentLength: providersData.length,
                //     totalUsd: processed.total_usd,
                //     tokenCount: processed.tokens.length,
                //     recommendedBlock // Log the block number we're using
                // });
            } else {
                logger.debug(`Skipping provider ${provider} - no rewards found`);
            }
        } catch (error) {
            logger.error(`Error processing provider ${provider}:`, error);
        }
    }

    logger.debug(`Final providersData:`, {
        providerCount: providersData.length,
        firstFewProviders: providersData.slice(0, 3),
        hasProviders: providersData.length > 0,
        timestamp: now.toISOString().slice(0, 10).replace(/-/g, '_'),
        total_providers: providers.length,
        providers_with_rewards: providersData.length
    });

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
            coingecko_prices: getCoingeckoPricesResolvedMap(timestamp)
        }
    };
}

export class MainnetGenLavaLatestProviderRewards {
    public static async Process(data: any): Promise<ProcessedRewardsData> {
        const processed: ProcessedRewardsData = {
            rewards_by_block: {},
            coingecko_prices: { tokens: [] },
            date: new Date().toISOString().split('T')[0]
        };

        // Process coingecko prices
        if (data.coingecko_prices?.tokens) {
            processed.coingecko_prices.tokens = data.coingecko_prices.tokens.map((token: any) => ({
                source_denom: token.source_denom,
                resolved_denom: token.resolved_denom,
                display_denom: token.display_denom,
                price: parseFloat(token.value_usd.replace('$', ''))
            }));
        }

        // Process rewards by block
        for (const [block, blockData] of Object.entries<BlockData>(data.rewards_by_block)) {
            processed.rewards_by_block[block] = {
                info: [],
                total: { tokens: [], total_usd: 0 }
            };

            // Process info items
            if (blockData.info) {
                processed.rewards_by_block[block].info = blockData.info.map((item: any) => ({
                    source: item.source,
                    amount: {
                        tokens: item.amount.tokens.map((token: any) => ({
                            source_denom: token.source_denom,
                            resolved_denom: token.resolved_denom,
                            display_denom: token.display_denom,
                            display_amount: token.display_amount,
                            resolved_amount: token.resolved_amount,
                            value_usd: `$${parseFloat(token.value_usd.replace('$', '')).toFixed(2)}`
                        })),
                        total_usd: item.amount.total_usd
                    }
                }));
            }

            // Process total
            if (blockData.total) {
                processed.rewards_by_block[block].total = {
                    tokens: blockData.total.tokens.map((token: any) => ({
                        source_denom: token.source_denom,
                        resolved_denom: token.resolved_denom,
                        display_denom: token.display_denom,
                        display_amount: token.display_amount,
                        resolved_amount: token.resolved_amount,
                        value_usd: `$${parseFloat(token.value_usd.replace('$', '')).toFixed(2)}`
                    })),
                    total_usd: blockData.total.total_usd
                };
            }
        }

        return processed;
    }
}
