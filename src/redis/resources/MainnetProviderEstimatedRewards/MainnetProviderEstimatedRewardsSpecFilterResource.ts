import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { MainnetProviderEstimatedRewardsGetService } from './MainnetProviderEstimatedRewardsGetResource';

export interface SpecFilterResponse {
    data: {
        spec: string;
        total_rewards: {
            tokens: Array<{
                amount: string;
                denom: string;
                original_denom: string;
                value_usd: string;
            }>;
            total_usd: number;
        };
        source_summaries: Array<{
            source: string;
            rewards: {
                tokens: Array<{
                    amount: string;
                    denom: string;
                    original_denom: string;
                    value_usd: string;
                }>;
                total_usd: number;
            };
        }>;
        top_providers: Array<{
            address: string;
            rewards: {
                tokens: Array<{
                    amount: string;
                    denom: string;
                    original_denom: string;
                    value_usd: string;
                }>;
                total_usd: number;
            };
        }>;
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
    };
}

class MainnetProviderEstimatedRewardsSpecFilterResource extends RedisResourceBase<SpecFilterResponse, { spec: string; block?: string | number }> {
    protected readonly redisKey = 'mainnet_provider_estimated_reward_spec_filter_v3';
    protected readonly cacheExpirySeconds = 10 * 60;

    private sumTokens(tokens: Array<{ amount: string; denom: string; original_denom: string; value_usd: string; }>) {
        const sums: Record<string, { amount: number; denom: string; original_denom: string; value_usd: number; }> = {};
        let total_usd = 0;

        tokens.forEach(token => {
            const amount = parseFloat(token.amount);
            const value_usd = parseFloat(token.value_usd.replace('$', ''));

            if (!sums[token.denom]) {
                sums[token.denom] = {
                    amount: 0,
                    denom: token.denom,
                    original_denom: token.original_denom,
                    value_usd: 0
                };
            }
            sums[token.denom].amount += amount;
            sums[token.denom].value_usd += value_usd;
            total_usd += value_usd;
        });

        return {
            tokens: Object.values(sums).map(t => ({
                amount: t.amount.toString(),
                denom: t.denom,
                original_denom: t.original_denom,
                value_usd: `$${t.value_usd.toFixed(2)}`
            })),
            total_usd
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
                }, {} as Record<string, Array<Array<{ amount: string; denom: string; original_denom: string; value_usd: string }>>>)
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