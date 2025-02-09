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

interface ProviderRewardsDataWithDynamicBlock {
    providers: Array<{
        address: string;
        rewards_by_block: {
            [key: string]: {
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

            return { data };
        } catch (error) {
            logger.error('Error fetching provider rewards data:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewardsGetService = new MainnetProviderEstimatedRewardsGetResource(); 