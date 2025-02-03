import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import {
    BlockMetadata,
    GenLavaLatestProviderRewards,
    ProcessedInfoItem,
    ProviderRewardsData
} from './MainnetGenLavaLatestProviderRewards';
import * as fs from 'fs';
import * as path from 'path';

export interface GetQueryParams {
    block?: string | number;
}

interface SummedTokenInfo {
    amount: string;           // Total amount in base units (e.g. "182000000")
    denom: string;           // Display denomination (e.g. "lava") 
    value_usd: string;       // Total USD value (e.g. "$0.00")
}

export interface TokenInfo {
    source_denom: string;     // e.g. "ulava"
    resolved_amount: string;  // e.g. "182.0"
    resolved_denom: string;   // e.g. "ulava"
    display_denom: string;    // e.g. "lava"
    display_amount: string;   // e.g. "0.000182"
    value_usd: string;       // e.g. "$0.00"
}

export interface CoinGeckoPriceInfo {
    source_denom: string;     // e.g. "ulava"
    resolved_denom: string;   // e.g. "ulava"
    display_denom: string;    // e.g. "lava"
    value_usd: string;       // e.g. "$0.15017163"
}

export interface ProviderRewardsDataWithDynamicBlock {
    providers: Array<{
        address: string;
        rewards_by_block: {
            [key: string]: {
                info: ProcessedInfoItem[];
                total: {
                    tokens: TokenInfo[];
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

export interface GetResourceResponse {
    data: ProviderRewardsDataWithDynamicBlock;
}

class MainnetProviderEstimatedRewardsGetResource extends RedisResourceBase<GetResourceResponse, GetQueryParams> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_get_v3';
    protected readonly cacheExpirySeconds = 10 * 60; // 10 minutes
    private readonly DATA_DIR = path.join(__dirname, 'data');

    private async loadBlockData(blockNumber: number): Promise<ProviderRewardsData | null> {
        const filePath = path.join(this.DATA_DIR, `provider_rewards_block_${blockNumber}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data) as ProviderRewardsData;
        } catch (error) {
            logger.error(`Error loading block data for ${blockNumber}:`, error);
            return null;
        }
    }

    protected async fetchFromSource(params?: GetQueryParams): Promise<GetResourceResponse> {
        try {
            const blockId = params?.block || 'latest';

            let data: ProviderRewardsData;
            if (blockId === 'latest') {
                data = await GenLavaLatestProviderRewards();
            } else {
                const blockData = await this.loadBlockData(Number(blockId));
                if (!blockData) {
                    throw new Error(`No data found for block ${blockId}`);
                }
                data = blockData;
            }

            // For non-latest blocks, return data exactly as it is in the JSON file
            if (blockId !== 'latest') {
                return { data: data as ProviderRewardsDataWithDynamicBlock };
            }

            // Only transform data for 'latest' block
            return {
                data: {
                    ...data,
                    providers: data.providers.map(p => ({
                        address: p.address,
                        rewards_by_block: {
                            [blockId]: p.rewards_by_block.latest
                        }
                    }))
                }
            };
        } catch (error) {
            logger.error('Error fetching provider rewards data:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewardsGetService = new MainnetProviderEstimatedRewardsGetResource(); 