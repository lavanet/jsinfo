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
    block_number: number;
    metadata: BlockMetadata;
}

interface ListResponse {
    blocks: AvailableBlock[];
    specs: string[];
    providers: string[];
}

export interface ProviderRewardsResourceResponse {
    data: ListResponse;
}

class MainnetProviderEstimatedRewardsListResource extends RedisResourceBase<ProviderRewardsResourceResponse, {}> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_list_v1';
    protected readonly cacheExpirySeconds = 10 * 60; // 10 minutes
    private readonly DATA_DIR = path.join(__dirname, 'data');

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

    private async getSpecsAndProviders(): Promise<{ specs: string[], providers: string[] }> {
        const specs = new Set<string>();
        const providers = new Set<string>();

        try {
            logger.debug('Fetching latest data for specs and providers');
            const response = await MainnetProviderEstimatedRewardsGetService.fetch({ block: 'latest' });
            if (!response) throw new Error('Failed to fetch latest data');
            const latestData = response.data;

            logger.debug('Latest data fetched:', {
                totalProviders: latestData.providers.length,
                hasMetadata: !!latestData.metadata,
                blockInfo: latestData.metadata?.block_info
            });

            latestData.providers.forEach((provider, index) => {
                logger.debug(`Processing provider ${index + 1}/${latestData.providers.length}:`, {
                    address: provider.address,
                    hasRewardsByBlock: !!provider.rewards_by_block,
                    hasLatest: !!provider.rewards_by_block?.latest,
                    infoLength: provider.rewards_by_block?.latest?.info?.length,
                    firstInfoItem: provider.rewards_by_block?.latest?.info?.[0]
                });

                if (provider.address) {
                    providers.add(provider.address);
                }

                const blockData = provider.rewards_by_block?.latest;
                if (blockData?.info) {
                    blockData.info.forEach((info, infoIndex) => {
                        logger.debug(`Processing info item ${infoIndex + 1}/${blockData.info.length}:`, {
                            source: info?.source,
                            hasAmount: !!info?.amount,
                            tokens: info?.amount?.tokens?.length
                        });

                        if (info?.source) {
                            const [prefix, spec] = info.source.split(': ');
                            logger.debug('Extracted spec:', { prefix, spec, fullSource: info.source });
                            if (spec) specs.add(spec);
                        }
                    });
                }
            });

            const result = {
                specs: Array.from(specs).sort(),
                providers: Array.from(providers).sort()
            };

            logger.debug('Final result:', {
                uniqueSpecs: result.specs.length,
                uniqueProviders: result.providers.length,
                specs: result.specs,
                firstFewProviders: result.providers.slice(0, 5)
            });

            return result;
        } catch (error) {
            logger.error('Error getting specs and providers:', {
                error,
                stack: error instanceof Error ? error.stack : undefined,
                errorType: error instanceof Error ? error.constructor.name : typeof error
            });
            return {
                specs: [],
                providers: []
            };
        }
    }

    protected async fetchFromSource(): Promise<ProviderRewardsResourceResponse> {
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