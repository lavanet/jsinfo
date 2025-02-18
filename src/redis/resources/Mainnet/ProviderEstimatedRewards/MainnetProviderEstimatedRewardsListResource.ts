import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as fs from 'fs';
import * as path from 'path';
import { MainnetProviderEstimatedRewardsGetService } from './MainnetProviderEstimatedRewardsGetResource';

interface BlockMetadata {
    height: number;
    time: string;
    seconds_off: number;
    date: string;
}

interface AvailableBlock {
    block_number: number | "latest";  // Allow "latest" as a value
    metadata: BlockMetadata;
}

interface ListResponse {
    data: {
        blocks: AvailableBlock[];  // Use AvailableBlock interface instead of inline type
        specs: string[];
        providers: string[];
    };
}

export interface ProviderRewardsResourceResponse {
    data: ListResponse;
}

export class MainnetProviderEstimatedRewardsListResource extends RedisResourceBase<ListResponse, {}> {
    protected readonly redisKey = 'mainnet_provider_estimated_rewards_list_v5';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours
    private readonly DATA_DIR = path.join(__dirname, 'data');

    private async getAvailableBlocks(): Promise<AvailableBlock[]> {
        try {
            // Get latest block data
            const latestResponse = await MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest' });
            const latestBlockInfo = latestResponse?.data?.metadata?.block_info;

            // Get historical blocks
            const files = await fs.promises.readdir(this.DATA_DIR);
            const blockFiles = files.filter(f => f.startsWith('provider_rewards_block_') && f.endsWith('.json'));

            const blocks: AvailableBlock[] = [];

            // Add latest block first
            if (latestBlockInfo) {
                blocks.push({
                    block_number: "latest",  // Use "latest" instead of number
                    metadata: latestBlockInfo
                });
            }

            // Add historical blocks
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

            return blocks.sort((a, b) => {
                if (a.block_number === "latest") return -1;
                if (b.block_number === "latest") return 1;
                return (b.block_number as number) - (a.block_number as number);
            });
        } catch (error) {
            logger.error('Error getting available blocks:', error);
            return [];
        }
    }

    private async getSpecsAndProviders(): Promise<{ specs: string[], providers: string[] }> {
        const specs = new Set<string>();
        const providers = new Set<string>();

        try {
            // Get providers from latest data
            const latestResponse = await MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest' });
            if (!latestResponse) throw new Error('Failed to fetch latest data');

            latestResponse.data.providers.forEach(provider => {
                if (provider.address) {
                    providers.add(provider.address);
                }
            });

            // Get specs from all stored blocks
            const files = await fs.promises.readdir(this.DATA_DIR);
            const blockFiles = files.filter(f => f.startsWith('provider_rewards_block_') && f.endsWith('.json'));

            for (const file of blockFiles) {
                const blockNumber = parseInt(file.replace('provider_rewards_block_', '').replace('.json', ''));
                const blockData = await this.loadBlockData(blockNumber);
                if (!blockData) continue;

                blockData.providers.forEach(provider => {
                    const rewardsData = provider.rewards_by_block?.[blockNumber];
                    if (rewardsData?.info) {
                        rewardsData.info.forEach(info => {
                            if (info?.source) {
                                const spec = info.source.split(': ')[1];
                                if (spec) {
                                    specs.add(spec.toUpperCase());
                                }
                            }
                        });
                    }
                });
            }

            return {
                specs: Array.from(specs).sort(),
                providers: Array.from(providers).sort()
            };
        } catch (error) {
            logger.error('Error getting specs and providers:', error);
            return { specs: [], providers: [] };
        }
    }

    protected async fetchFromSource(): Promise<ListResponse> {
        try {
            const [blocks, { specs, providers }] = await Promise.all([
                this.getAvailableBlocks(),
                this.getSpecsAndProviders()
            ]);

            return {
                data: {
                    blocks,
                    specs,
                    providers
                }
            };
        } catch (error) {
            logger.error('Error fetching list data:', error);
            throw error;
        }
    }

    private async loadBlockData(blockNumber: number) {
        const filePath = path.join(this.DATA_DIR, `provider_rewards_block_${blockNumber}.json`);
        try {
            const data = await fs.promises.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error(`Error loading block data for ${blockNumber}:`, error);
            return null;
        }
    }
}

export const MainnetProviderEstimatedRewardsListService = new MainnetProviderEstimatedRewardsListResource(); 