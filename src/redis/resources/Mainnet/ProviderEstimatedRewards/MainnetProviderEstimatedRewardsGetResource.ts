import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import {
    GenLavaLatestProviderRewards,
    ProviderRewardsData
} from './MainnetGenLavaLatestProviderRewards';
import * as fs from 'fs';
import * as path from 'path';

export interface GetQueryParams {
    block?: string | number;
}

export interface TokenInfo {
    source_denom: string;
    resolved_amount: string;
    resolved_denom: string;
    display_denom: string;
    display_amount: string;
    value_usd: string;
}

export interface CoinGeckoPriceInfo {
    source_denom: string;
    resolved_denom: string;
    display_denom: string;
    value_usd: string;
}

export interface GetResourceResponse {
    data: ProviderRewardsData;
}

class MainnetProviderEstimatedRewardsGetResource extends RedisResourceBase<GetResourceResponse, GetQueryParams> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_getnever_v20';
    protected readonly cacheExpirySeconds = 7200 * 2; // 4 hours
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
                return { data: data };
            }

            // Only transform data for 'latest' block
            return { data: data };
        } catch (error) {
            logger.error('Error fetching provider rewards data:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewardsGetService = new MainnetProviderEstimatedRewardsGetResource(); 