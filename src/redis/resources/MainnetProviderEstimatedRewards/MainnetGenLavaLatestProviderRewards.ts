import { logger } from '@jsinfo/utils/logger';
import { ProcessTokenArray, ProcessedTokenArray } from '@jsinfo/restRpc/ProcessLavaRpcTokenArray';
import { EstimatedRewardsResponse, MainnetRpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { FetchRestData } from '@jsinfo/restRpc/fetch';

const LAVA_RPC_BENCHMARK_AMOUNT = 10000 * 1000000; // 10000 LAVA in ulava
const LAVA_RPC_BENCHMARK_DENOM = "ulava";
const MAINNET_INFO_URL = 'https://jsinfo.mainnet.lavanet.xyz/latest';
const MAINNET_ACTIVE_PROVIDERS_URL = 'https://jsinfo.mainnet.lavanet.xyz/active_providers';
const FETCH_TIMEOUT = 120000; // 120 seconds

interface MainnetLatestBlock {
    height: number;
    datetime: number;
}

interface MainnetActiveProvidersResponse {
    providers: string[];
}

interface ProcessedInfoItem {
    source: string;
    amount: ProcessedTokenArray;
}

interface ProviderRewardsData {
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
        block_info: {
            height: number;
            time: string;
            seconds_off: number;
            date: string;
        } | null;
        coingecko_prices: Record<string, number>;
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

async function processInfoAmounts(infoList: EstimatedRewardsResponse['info']): Promise<ProcessedInfoItem[]> {
    const result: ProcessedInfoItem[] = [];

    for (const info of infoList) {
        const processed = await ProcessTokenArray([{
            amount: info.amount.amount,
            denom: info.amount.denom
        }]);
        result.push({
            source: info.source,
            amount: processed
        });
    }

    return result;
}

async function processRewardsResponse(rewards: EstimatedRewardsResponse): Promise<{
    info: ProcessedInfoItem[];
    total: ProcessedTokenArray | null;
    recommended_block: string;
}> {
    if (!rewards?.info) {
        logger.warn('No rewards info in response');
        return {
            info: [],
            total: null,
            recommended_block: "0"
        };
    }

    logger.info(`Processing rewards response with ${rewards.info.length} info items`);

    const processedInfo = await processInfoAmounts(rewards.info);
    logger.info(`Processed ${processedInfo.length} info items`);

    const processedTotal = rewards.total ? await ProcessTokenArray(
        rewards.total.map(t => ({ amount: t.amount, denom: t.denom }))
    ) : null;

    if (processedTotal) {
        logger.info(`Processed total with ${processedTotal.tokens.length} tokens`);
    }

    return {
        info: processedInfo,
        total: processedTotal,
        recommended_block: rewards.recommended_block
    };
}

async function GenLavaLatestProviderRewards(): Promise<ProviderRewardsData> {
    logger.info('Generating latest provider rewards...');

    const latestBlock = await getMainnetLatestBlock();
    const blockTime = new Date(latestBlock.datetime);
    const now = new Date();

    const providers = await getActiveProviders();
    if (!providers.length) {
        throw new Error('No providers found');
    }
    logger.info(`Found ${providers.length} active providers`);

    const providersData: ProviderRewardsData['providers'] = [];
    const priceCache: Record<string, number> = {};

    for (const provider of providers) {
        try {
            logger.info(`Fetching rewards for provider ${provider}`);
            const rewardsResponse = await MainnetRpcOnDemandEndpointCache.GetEstimatedProviderRewards(
                provider,
                LAVA_RPC_BENCHMARK_AMOUNT,
                LAVA_RPC_BENCHMARK_DENOM
            );

            logger.info(`Raw rewards response for ${provider}:`, JSON.stringify(rewardsResponse));

            if (!rewardsResponse?.info) {
                logger.warn(`No rewards info for provider ${provider}`);
                continue;
            }

            const processed = await processRewardsResponse(rewardsResponse);
            if (processed.info.length > 0) {
                logger.info(`Got rewards for provider ${provider}`);
                // Cache prices for metadata
                for (const info of processed.info) {
                    if (info.amount.tokens) {
                        for (const token of info.amount.tokens) {
                            if (!priceCache[token.denom]) {
                                priceCache[token.denom] = await CoinGekoCache.GetDenomToUSDRate(token.denom);
                            }
                        }
                    }
                }

                providersData.push({
                    address: provider,
                    rewards_by_block: {
                        latest: {
                            info: processed.info,
                            total: processed.total || {
                                tokens: [],
                                total_usd: 0
                            },
                            recommended_block: processed.recommended_block
                        }
                    }
                });
            } else {
                logger.warn(`No processed rewards for provider ${provider}`);
            }
        } catch (error) {
            logger.error(`Error processing provider ${provider}:`, error);
        }
    }

    logger.info(`Processed ${providersData.length} providers with rewards out of ${providers.length} total`);

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
            coingecko_prices: priceCache
        }
    };
}

export {
    GenLavaLatestProviderRewards,
    ProviderRewardsData
};