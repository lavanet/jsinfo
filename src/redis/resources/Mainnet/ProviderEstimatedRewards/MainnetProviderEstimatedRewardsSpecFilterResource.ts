import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { MainnetProviderEstimatedRewardsGetService, CoinGeckoPriceInfo } from './MainnetProviderEstimatedRewardsGetResource';
import { TokenInfo, BlockMetadata } from './MainnetGenLavaLatestProviderRewards';
import Decimal from 'decimal.js';

export interface SpecFilterResponse {
    data: {
        spec: string;
        total_rewards: {
            tokens: TokenInfo[];
            total_usd: number;
        };
        source_summaries: Array<{
            source: string;
            rewards: {
                tokens: TokenInfo[];
                total_usd: number;
            };
        }>;
        top_providers: Array<{
            address: string;
            rewards: {
                tokens: TokenInfo[];
                total_usd: number;
            };
        }>;
        metadata: {
            generated_at: string;
            block_info: BlockMetadata | null;
            coingecko_prices: {
                tokens: CoinGeckoPriceInfo[];
            };
        };
    };
}

class MainnetProviderEstimatedRewardsSpecFilterResource extends RedisResourceBase<SpecFilterResponse, { spec: string; block?: string | number }> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_spec_filter_v3';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours

    private sumTokens(tokens: TokenInfo[]) {
        const sums: Record<string, TokenInfo> = {};
        let total_usd = new Decimal(0);

        tokens.forEach(token => {
            const value_usd = new Decimal(token.value_usd.replace('$', ''));
            const key = token.resolved_denom;

            if (!sums[key]) {
                sums[key] = {
                    source_denom: token.source_denom,
                    resolved_amount: '0',
                    resolved_denom: token.resolved_denom,
                    display_denom: token.display_denom,
                    display_amount: '0',
                    value_usd: '$0.00'
                };
            }

            const newResolvedAmount = new Decimal(sums[key].resolved_amount)
                .plus(new Decimal(token.resolved_amount));

            const currentUsd = new Decimal(sums[key].value_usd.replace('$', ''));
            const newUsd = currentUsd.plus(value_usd);

            sums[key].resolved_amount = newResolvedAmount.toString();
            sums[key].value_usd = `$${newUsd.toFixed(2)}`;
            total_usd = total_usd.plus(value_usd);
        });

        return {
            tokens: Object.values(sums),
            total_usd: total_usd.toNumber()
        };
    }

    private normalizeSource(source: string): string {
        // Extract the prefix (Boost/Pools/etc) and normalize the spec name
        const [prefix, specPart] = source.split(': ');
        const normalizedSpec = specPart.replace(/T$/, ''); // Remove trailing T
        return `${prefix}: ${normalizedSpec}`;
    }

    protected async fetchFromSource(params?: { spec: string; block?: string | number }): Promise<SpecFilterResponse> {
        try {
            if (!params?.spec) throw new Error('Spec parameter is required');
            const { spec, block = 'latest' } = params;

            const response = await MainnetProviderEstimatedRewardsGetService.fetch({ block });
            if (!response) throw new Error('Failed to fetch data');

            // Get all matching info items across all providers
            const allSpecInfo = response.data.providers.flatMap(provider =>
                Object.values(provider.rewards_by_block).flatMap(blockData =>
                    blockData.info.filter(info => info.source.toUpperCase().includes(spec.toUpperCase()))
                )
            );

            // Group by normalized source and sum rewards
            const sourceSummaries = Object.entries(
                allSpecInfo.reduce((acc, info) => {
                    const normalizedSource = this.normalizeSource(info.source);
                    if (!acc[normalizedSource]) {
                        acc[normalizedSource] = [];
                    }
                    acc[normalizedSource].push(info.amount.tokens);
                    return acc;
                }, {} as Record<string, Array<TokenInfo[]>>)
            ).map(([source, tokenArrays]) => ({
                source,
                rewards: this.sumTokens(tokenArrays.flat())
            })).sort((a, b) => b.rewards.total_usd - a.rewards.total_usd);

            // Calculate provider rewards as before
            const providerRewards = response.data.providers.map(provider => {
                const specRewards = Object.values(provider.rewards_by_block).flatMap(blockData =>
                    blockData.info
                        .filter(info => info.source.toUpperCase().includes(spec.toUpperCase()))
                        .flatMap(info => info.amount.tokens)
                );

                return {
                    address: provider.address,
                    rewards: this.sumTokens(specRewards)
                };
            }).filter(p => p.rewards.total_usd > 0)
                .sort((a, b) => b.rewards.total_usd - a.rewards.total_usd)
                .slice(0, 10);

            const totalRewards = this.sumTokens(providerRewards.flatMap(p => p.rewards.tokens));

            return {
                data: {
                    spec: spec.toUpperCase(),
                    total_rewards: totalRewards,
                    source_summaries: sourceSummaries,
                    top_providers: providerRewards,
                    metadata: response.data.metadata
                }
            };
        } catch (error) {
            logger.error('Error filtering by spec:', error);
            throw error;
        }
    }
}

export const MainnetProviderEstimatedRewardsSpecFilterService = new MainnetProviderEstimatedRewardsSpecFilterResource(); 