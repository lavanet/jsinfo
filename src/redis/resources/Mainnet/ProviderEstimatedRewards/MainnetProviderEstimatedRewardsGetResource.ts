import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import {
    GenLavaLatestProviderRewards,
    ProviderRewardsData
} from './MainnetGenLavaLatestProviderRewards';
import * as fs from 'fs';
import * as path from 'path';

export interface GetQueryParams {
    block?: string | number | 'latest_distributed' | 'latest';
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
    protected readonly redisKey = 'mainnet_provider_estimated_reward_getnever_v21';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours
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

            if (blockId === 'latest_distributed') {
                const files = await fs.promises.readdir(this.DATA_DIR);
                let latestBlock = 0;

                for (const file of files) {
                    if (file.startsWith('provider_rewards_block_') && file.endsWith('.json')) {
                        const blockNum = parseInt(file.replace('provider_rewards_block_', '').replace('.json', ''));
                        if (blockNum > latestBlock) {
                            latestBlock = blockNum;
                        }
                    }
                }

                if (latestBlock > 0) {
                    const blockData = await this.loadBlockData(latestBlock);
                    if (!blockData) {
                        throw new Error(`No data found for latest distributed block ${latestBlock}`);
                    }
                    return { data: blockData };
                }
                throw new Error('No distributed rewards data found');
            }

            let data: ProviderRewardsData;
            if (blockId === 'latest') {
                data = await GenLavaLatestProviderRewards();
                return { data };

            }
            const blockData = await this.loadBlockData(Number(blockId));
            if (!blockData) {
                throw new Error(`No data found for block ${blockId}`);
            }

            return { data: blockData };

        } catch (error) {
            logger.error('Error fetching provider rewards data:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewardsGetService = new MainnetProviderEstimatedRewardsGetResource(); 