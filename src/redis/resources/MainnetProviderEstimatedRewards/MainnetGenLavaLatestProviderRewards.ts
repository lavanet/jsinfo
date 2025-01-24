import { logger } from '@jsinfo/utils/logger';
import { ProcessTokenArray, ProcessedTokenArray } from '@jsinfo/restRpc/ProcessLavaRpcTokenArray';
import { EstimatedRewardsResponse, MainnetGetEstimatedProviderRewardsNoAmountNoDenom } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { FetchRestData } from '@jsinfo/restRpc/fetch';

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

export interface ProcessedInfoItem {
    source: string;
    amount: ProcessedTokenArray;
}

export interface BlockMetadata {
    height: number;
    time: string;
    seconds_off: number;
    date: string;
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

    if (!infoList) {
        logger.error('processInfoAmounts: Invalid info list:', {
            input: {
                value: infoList,
                type: typeof infoList
            },
            callStack: new Error().stack
        });
        throw new Error('processInfoAmounts: Invalid or empty info list provided');
    }

    for (const info of infoList) {
        try {
            if (!info || !info.source || !info.amount) {
                logger.error('processInfoAmounts: Invalid info item:', {
                    invalidItem: {
                        raw: info,
                        hasSource: !!info?.source,
                        hasAmount: !!info?.amount,
                        amountType: typeof info?.amount
                    },
                    context: {
                        processedCount: result.length,
                        remainingItems: infoList.length - result.length,
                        fullInfoList: JSON.stringify(infoList, null, 2)
                    }
                });
                throw new Error('Invalid info item structure');
            }

            const amounts = Array.isArray(info.amount) ? info.amount : [info.amount];
            if (!amounts.length) {
                logger.error('processInfoAmounts: Empty amounts array:', {
                    info: JSON.stringify(info, null, 2),
                    amounts,
                    context: {
                        source: info.source,
                        processedCount: result.length
                    }
                });
                throw new Error('Empty amounts array for info item');
            }

            const processed = await ProcessTokenArray(amounts);
            result.push({
                source: info.source,
                amount: processed
            });
        } catch (error) {
            logger.error('processInfoAmounts: Failed to process info item:', {
                failedItem: {
                    raw: JSON.stringify(info, null, 2),
                    source: info?.source,
                    amountType: typeof info?.amount,
                    isAmountArray: Array.isArray(info?.amount)
                },
                processingState: {
                    processedCount: result.length,
                    totalItems: infoList.length,
                    currentResults: result
                },
                error: error instanceof Error ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                } : error,
                context: {
                    timestamp: new Date().toISOString(),
                    memoryUsage: process.memoryUsage()
                }
            });
            throw error;
        }
    }

    return result;
}

async function processRewardsResponse(rewards: EstimatedRewardsResponse): Promise<{
    info: ProcessedInfoItem[];
    total: ProcessedTokenArray | null;
    recommended_block: string;
}> {
    // logger.info('Raw rewards response:', JSON.stringify(rewards, null, 2));
    // logger.info(`Processing rewards response with ${rewards.info?.length || 0} info items and ${rewards.total?.length || 0} total items`);

    // Only process info from the actual info array
    const processedInfo = rewards.info ? await processInfoAmounts(rewards.info) : [];

    // Process total separately
    const processedTotal = rewards.total ? await ProcessTokenArray(
        rewards.total.map(t => {
            // logger.info('Processing total token:', t);
            return { amount: t.amount, denom: t.denom };
        })
    ) : null;

    // logger.info(`Processed ${processedInfo.length} info items and ${processedTotal?.tokens.length || 0} total tokens`);

    return {
        info: processedInfo,
        total: processedTotal,
        recommended_block: rewards.recommended_block || "0"
    };
}

export async function GenLavaLatestProviderRewards(): Promise<ProviderRewardsData> {
    // logger.info('Generating latest provider rewards...');

    const latestBlock = await getMainnetLatestBlock();
    const blockTime = new Date(latestBlock.datetime);
    const now = new Date();

    const providers = await getActiveProviders();
    if (!providers.length) {
        throw new Error('No providers found');
    }
    // logger.info(`Found ${providers.length} active providers`);

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
    const priceCache: Record<string, number> = {};

    for (const provider of providers) {
        try {
            // logger.info(`Fetching rewards for provider ${provider}`);
            const rewardsResponse = await MainnetGetEstimatedProviderRewardsNoAmountNoDenom(
                provider
            );

            // logger.info(`Raw rewards response for ${provider}:`, JSON.stringify(rewardsResponse));

            const processed = await processRewardsResponse(rewardsResponse);
            if (processed.info.length > 0 || (processed.total && processed.total.tokens.length > 0)) {
                logger.info(`Got rewards for provider ${provider}`);

                const allTokens = [
                    ...processed.info.flatMap(info => info.amount.tokens || []),
                    ...(processed.total?.tokens || [])
                ];

                for (const token of allTokens) {
                    if (!priceCache[token.denom]) {
                        priceCache[token.denom] = await CoinGekoCache.GetDenomToUSDRate(token.denom);
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
                // logger.warn(`No processed rewards or totals for provider ${provider}`);
            }
        } catch (error) {
            // logger.error(`Error processing provider ${provider}:`, error);
        }
    }

    // logger.info(`Processed ${providersData.length} providers with rewards out of ${providers.length} total`);

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
