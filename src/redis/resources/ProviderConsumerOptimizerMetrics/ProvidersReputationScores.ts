// src/redis/resources/provider/consumerOptimizerMetrics.ts

import { and, eq, gte, lte } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { aggregatedConsumerOptimizerMetrics } from '@jsinfo/schemas/relaysSchema';
import { logger } from '@jsinfo/utils/logger';
import { ActiveProvidersService } from '../index/ActiveProvidersResource';
import Decimal from 'decimal.js';
import { queryRelays } from '@jsinfo/utils/db';

const WEIGHTS = [0.4, 0.25, 0.15, 0.1, 0.05, 0.03, 0.02];
const DAYS_TO_ANALYZE = 7;

interface DailyScore {
    date: Date;
    score: number;
    metrics_count: number;
}

interface ProviderScores {
    provider: string;
    chainScores: {
        [chain: string]: DailyScore[];
    };
}

interface ProviderReputationScore {
    provider: string;
    reputationScore: number;
    totalMetrics: number;
    details: {
        confidenceReached: boolean;
        chainsAnalyzed: number;
        totalDaysWithDataInAllChains: number;
        totalDaysWithDataInAllChainsUsedInScore: number;
        rawScore: number;
        breakdown: {
            [chain: string]: {
                daysWithData: number;
                totalMetrics: number;
                averageScore: number;
                meetsConfidence: boolean;
                dailyScores: {
                    date: string;
                    score: number;
                    metrics: number;
                    weight: number;
                }[];
            }
        }
    };
}
export class ProvidersReputationScoresResource extends RedisResourceBase<ProviderReputationScore[], {}> {
    protected redisKey = 'providers_reputation_scores_v4';
    protected cacheExpirySeconds = 3600; // 1 hour

    protected async fetchFromSource(): Promise<ProviderReputationScore[]> {
        try {
            const activeProviders = await ActiveProvidersService.fetch();
            if (!activeProviders || activeProviders.length === 0) {
                return [];
            }

            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - DAYS_TO_ANALYZE);

            const rawScores = await this.fetchProviderScores(activeProviders, startDate, endDate);
            return this.calculateReputationScores(rawScores);
        } catch (error) {
            logger.error('Error fetching provider reputation scores:', error);
            return [];
        }
    }

    private async fetchProviderScores(providers: string[], startDate: Date, endDate: Date): Promise<ProviderScores[]> {
        const scores: ProviderScores[] = [];

        for (const provider of providers) {
            const metrics = await queryRelays(db =>
                db.select({
                    chain: aggregatedConsumerOptimizerMetrics.chain,
                    hourly_timestamp: aggregatedConsumerOptimizerMetrics.hourly_timestamp,
                    metrics_count: aggregatedConsumerOptimizerMetrics.metrics_count,
                    generic_score_sum: aggregatedConsumerOptimizerMetrics.generic_score_sum,
                })
                    .from(aggregatedConsumerOptimizerMetrics)
                    .where(and(
                        eq(aggregatedConsumerOptimizerMetrics.provider, provider),
                        gte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, startDate),
                        lte(aggregatedConsumerOptimizerMetrics.hourly_timestamp, endDate)
                    ))
                    .orderBy(aggregatedConsumerOptimizerMetrics.hourly_timestamp),
                `ProvidersReputationScores_fetchProviderScores_${provider}`
            );

            const chainScores: { [chain: string]: DailyScore[] } = {};

            metrics.forEach(metric => {
                if (!metric.chain || !metric.metrics_count || !metric.generic_score_sum) return;

                const date = new Date(metric.hourly_timestamp);
                date.setHours(0, 0, 0, 0); // Normalize to start of day

                if (!chainScores[metric.chain]) {
                    chainScores[metric.chain] = [];
                }

                const existingScore = chainScores[metric.chain].find(
                    s => s.date.getTime() === date.getTime()
                );

                const score = Number(metric.generic_score_sum) / Number(metric.metrics_count);

                if (existingScore) {
                    existingScore.score = (existingScore.score * existingScore.metrics_count + score * Number(metric.metrics_count))
                        / (existingScore.metrics_count + Number(metric.metrics_count));
                    existingScore.metrics_count += Number(metric.metrics_count);
                } else {
                    chainScores[metric.chain].push({
                        date,
                        score,
                        metrics_count: Number(metric.metrics_count)
                    });
                }
            });

            scores.push({ provider, chainScores });
        }

        return scores;
    }

    private calculateReputationScores(providerScores: ProviderScores[]): ProviderReputationScore[] {
        const MIN_CONFIDENCE_DAYS = 3;
        const MIN_METRICS_PER_DAY = 50;
        const EXPECTED_DAYS = 7;  // We analyze 7 days

        const rawScores = providerScores.map(providerData => {
            let totalWeightedScore = new Decimal(0);
            let totalWeight = new Decimal(0);
            let totalMetrics = 0;
            let chainsAnalyzed = 0;
            let totalDaysWithDataInAllChains = 0;
            let totalDaysWithDataInAllChainsUsedInScore = 0;
            let hasAnyConfidentChain = false;

            const totalChains = Object.keys(providerData.chainScores).length;
            let minDailyScore = Number.MAX_VALUE;
            let maxDailyScore = 0;

            const breakdown: Record<string, any> = {};

            Object.entries(providerData.chainScores).forEach(([chain, chainScores]) => {
                const daysWithData = chainScores.length;
                totalDaysWithDataInAllChains += daysWithData;

                const hasEnoughMetrics = chainScores.every(score => score.metrics_count >= MIN_METRICS_PER_DAY);
                const meetsConfidence = daysWithData >= MIN_CONFIDENCE_DAYS && hasEnoughMetrics;

                if (meetsConfidence) {
                    hasAnyConfidentChain = true;
                    totalDaysWithDataInAllChainsUsedInScore += daysWithData;
                }

                // Sort scores by date, newest first
                const sortedScores = chainScores.sort((a, b) => b.date.getTime() - a.date.getTime());

                let chainTotalScore = new Decimal(0);
                let chainTotalWeight = new Decimal(0);
                let chainTotalMetrics = 0;

                const dailyScores: any[] = [];

                sortedScores.forEach((score, index) => {
                    if (score.score > 0) {
                        minDailyScore = Math.min(minDailyScore, score.score);
                        maxDailyScore = Math.max(maxDailyScore, score.score);
                    }

                    const weight = index < WEIGHTS.length ? WEIGHTS[index] : 0;

                    dailyScores.push({
                        date: score.date.toISOString().split('T')[0],
                        score: score.score,
                        metrics: score.metrics_count,
                        weight: weight
                    });

                    if (index < WEIGHTS.length && meetsConfidence) {
                        const decimalWeight = new Decimal(weight);
                        chainTotalScore = chainTotalScore.plus(
                            new Decimal(score.score).times(decimalWeight).times(score.metrics_count)
                        );
                        chainTotalWeight = chainTotalWeight.plus(decimalWeight.times(score.metrics_count));
                        chainTotalMetrics += score.metrics_count;
                    }
                });

                // Enhanced breakdown with additional statistics
                breakdown[chain] = {
                    daysWithData,
                    totalMetrics: chainScores.reduce((sum, s) => sum + s.metrics_count, 0),
                    averageScore: chainTotalWeight.isZero() ? 0 :
                        chainTotalScore.dividedBy(chainTotalWeight).toNumber(),
                    meetsConfidence,
                    originalAverageScore: dailyScores.length > 0 ?
                        dailyScores.reduce((sum, s) => sum + s.score, 0) / dailyScores.length : 0,
                    dailyScores
                };

                if (meetsConfidence) {
                    totalWeightedScore = totalWeightedScore.plus(chainTotalScore);
                    totalWeight = totalWeight.plus(chainTotalWeight);
                    totalMetrics += chainTotalMetrics;
                    chainsAnalyzed++;
                }
            });

            const dayCoverage = totalDaysWithDataInAllChainsUsedInScore / (chainsAnalyzed * EXPECTED_DAYS);

            const rawScore = totalWeight.isZero() ? 0 :
                totalWeightedScore.dividedBy(totalWeight).toNumber();

            return {
                provider: providerData.provider,
                rawScore: hasAnyConfidentChain ? rawScore : 0,
                totalMetrics,
                chainsAnalyzed,
                totalDaysWithDataInAllChains,
                totalDaysWithDataInAllChainsUsedInScore,
                confidenceScore: hasAnyConfidentChain,
                breakdown,
                statistics: {
                    totalChains,
                    chainsWithConfidence: chainsAnalyzed,
                    minDailyScore: minDailyScore === Number.MAX_VALUE ? 0 : minDailyScore,
                    maxDailyScore,
                    scoreRange: maxDailyScore - (minDailyScore === Number.MAX_VALUE ? 0 : minDailyScore),
                    dayCoverage: Math.min(1, dayCoverage)
                }
            };
        });

        // Normalize scores between 0.5 and 2.0 for valid scores
        const validScores = rawScores.filter(s => s.rawScore > 0);
        if (validScores.length === 0) {
            return rawScores.map(s => ({
                provider: s.provider,
                reputationScore: 0,
                totalMetrics: s.totalMetrics,
                details: {
                    confidenceReached: false,
                    chainsAnalyzed: s.chainsAnalyzed,
                    totalDaysWithDataInAllChains: s.totalDaysWithDataInAllChains,
                    totalDaysWithDataInAllChainsUsedInScore: s.totalDaysWithDataInAllChainsUsedInScore,
                    rawScore: 0,
                    breakdown: s.breakdown,
                    statistics: s.statistics
                }
            }));
        }

        // Calculate normalization with protection against outliers
        const minScore = Math.min(...validScores.map(s => s.rawScore));
        const maxScore = Math.max(...validScores.map(s => s.rawScore));
        const scoreRange = maxScore - minScore;

        return rawScores.map(score => ({
            provider: score.provider,
            reputationScore: score.rawScore === 0 ? 0 :
                0.5 + (1.5 * (score.rawScore - minScore) / (scoreRange > 0 ? scoreRange : 1)),
            totalMetrics: score.totalMetrics,
            details: {
                confidenceReached: score.confidenceScore && score.rawScore > 0,
                chainsAnalyzed: score.chainsAnalyzed,
                totalDaysWithDataInAllChains: score.totalDaysWithDataInAllChains,
                totalDaysWithDataInAllChainsUsedInScore: score.totalDaysWithDataInAllChainsUsedInScore,
                rawScore: score.rawScore,
                breakdown: score.breakdown,
                normalization: {
                    minScoreInSystem: minScore,
                    maxScoreInSystem: maxScore,
                    scoreRange: scoreRange
                },
                statistics: score.statistics
            }
        }));
    }
}

export const ProvidersReputationScoresService = new ProvidersReputationScoresResource();

