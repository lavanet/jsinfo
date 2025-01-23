import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { GenLavaLatestProviderRewards, ProviderRewardsData } from './MainnetGenLavaLatestProviderRewards';
import * as fs from 'fs';
import * as path from 'path';

interface BlockMetadata {
    height: number;
    time: string;
    seconds_off: number;
    date: string;
}

interface AvailableBlock {
    block_number: number;
    metadata: BlockMetadata;
}

export type ProviderRewardsQueryType = 'latest' | 'historical' | 'blocks';

export interface ProviderRewardsQueryParams {
    type: ProviderRewardsQueryType;
    block?: number;
}

export interface ProviderRewardsResourceResponse {
    type: ProviderRewardsQueryType;
    data?: ProviderRewardsData | AvailableBlock[];
}

class MainnetProviderEstimatedRewardsResource extends RedisResourceBase<ProviderRewardsResourceResponse, ProviderRewardsQueryParams> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_v2';
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

    private async getAvailableBlocks(): Promise<AvailableBlock[]> {
        try {
            const files = await fs.promises.readdir(this.DATA_DIR);
            const blockFiles = files.filter(f => f.startsWith('provider_rewards_block_') && f.endsWith('.json'));

            const blocks: AvailableBlock[] = [];
            for (const file of blockFiles) {
                const blockNumber = parseInt(file.replace('provider_rewards_block_', '').replace('.json', ''));
                const data = await this.loadBlockData(blockNumber);
                if (data?.metadata?.block_info) {
                    blocks.push({
                        block_number: blockNumber,
                        metadata: data.metadata.block_info
                    });
                }
            }

            return blocks.sort((a, b) => b.block_number - a.block_number);
        } catch (error) {
            logger.error('Error getting available blocks:', error);
            return [];
        }
    }

    protected getDefaultParams(): ProviderRewardsQueryParams {
        return {
            type: 'latest'
        };
    }

    protected async fetchFromSource(params?: ProviderRewardsQueryParams): Promise<ProviderRewardsResourceResponse> {
        const queryParams = params || this.getDefaultParams();
        const queryType = queryParams.type || 'latest';

        try {
            switch (queryType) {
                case 'latest':
                    return {
                        type: 'latest',
                        data: await GenLavaLatestProviderRewards()
                    };
                case 'historical':
                    if (!queryParams.block) {
                        throw new Error('Block number required for historical query');
                    }
                    return {
                        type: 'historical',
                        data: await this.loadBlockData(queryParams.block) ?? []
                    };
                case 'blocks':
                    return {
                        type: 'blocks',
                        data: await this.getAvailableBlocks()
                    };
                default:
                    throw new Error(`Unsupported query type: ${queryType}`);
            }
        } catch (error) {
            logger.error('Error fetching provider estimated rewards:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewards = new MainnetProviderEstimatedRewardsResource(); 