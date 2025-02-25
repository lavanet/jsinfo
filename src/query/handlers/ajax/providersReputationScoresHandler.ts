import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { logger } from '@jsinfo/utils/logger';
import { ProvidersReputationScoresService } from '@jsinfo/redis/resources/ProviderConsumerOptimizerMetrics/ProvidersReputationScores';

export interface ProvidersReputationScoresResponse {
    data: {
        provider: string;
        reputationScore: number;
        totalMetrics: number;
        details: {
            confidenceReached: boolean;
            chainsAnalyzed: number;
            daysWithData: number;
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
    }[];
}

export const ProvidersReputationScoresHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                provider: { type: 'string' },
                                reputationScore: { type: 'number' },
                                totalMetrics: { type: 'number' },
                                details: {
                                    type: 'object',
                                    properties: {
                                        confidenceReached: { type: 'boolean' },
                                        chainsAnalyzed: { type: 'number' },
                                        daysWithData: { type: 'number' },
                                        rawScore: { type: 'number' },
                                        breakdown: {
                                            type: 'object',
                                            additionalProperties: {
                                                type: 'object',
                                                properties: {
                                                    daysWithData: { type: 'number' },
                                                    totalMetrics: { type: 'number' },
                                                    averageScore: { type: 'number' },
                                                    meetsConfidence: { type: 'boolean' },
                                                    dailyScores: {
                                                        type: 'array',
                                                        items: {
                                                            type: 'object',
                                                            properties: {
                                                                date: { type: 'string' },
                                                                score: { type: 'number' },
                                                                metrics: { type: 'number' },
                                                                weight: { type: 'number' }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
};

export async function ProvidersReputationScoresHandler(
    request: FastifyRequest,
    reply: FastifyReply
): Promise<ProvidersReputationScoresResponse | null> {
    try {
        const scores = await ProvidersReputationScoresService.fetch();

        if (!scores || scores.length === 0) {
            reply.status(400);
            reply.send({ error: 'No reputation scores available' });
            return null;
        }

        return { data: scores };
    } catch (error) {
        logger.error('Error in ProvidersReputationScoresHandler:', error);
        reply.status(500);
        reply.send({ error: 'Failed to fetch provider reputation scores' });
        return null;
    }
}
