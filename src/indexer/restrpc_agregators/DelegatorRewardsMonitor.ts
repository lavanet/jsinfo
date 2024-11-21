import { logger } from '@jsinfo/utils/logger';
import { RpcPeriodicEndpointCache } from '@jsinfo/indexer/classes/RpcPeriodicEndpointCache';
import { RpcOnDemandEndpointCache } from '@jsinfo/indexer/classes/RpcOnDemandEndpointCache';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { ConvertToBaseDenom, GetUSDCValue } from "./CurrencyConverstionUtils";
import { sql } from 'drizzle-orm';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface ProcessedRewardAmount {
    amount: number;
    denom: string;
    usdcValue: number;
    provider: string;
}

class DelegatorRewardsMonitorClass {
    private intervalId: NodeJS.Timer | null = null;
    private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    private rewardsBatch: { delegator: string; rewards: ProcessedRewardAmount[]; timestamp: Date; }[] = [];
    private lastBatchUpdate = Date.now();
    private readonly BATCH_SIZE = 100;
    private readonly BATCH_TIMEOUT = 5 * 60 * 1000; // 5 minutes

    public start(): void {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.ProcessDelegatorRewards().catch(console.error);
        }, this.UPDATE_INTERVAL);

        // Initial run
        this.ProcessDelegatorRewards().catch(console.error);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async updateRewardsInDb(delegator: string, rewards: ProcessedRewardAmount[]): Promise<void> {
        try {
            this.rewardsBatch.push({
                delegator,
                rewards,
                timestamp: new Date()
            });

            const shouldUpdate =
                this.rewardsBatch.length >= this.BATCH_SIZE ||
                Date.now() - this.lastBatchUpdate >= this.BATCH_TIMEOUT;

            if (!shouldUpdate) return;

            // Prepare batch values using individual timestamps
            const values = this.rewardsBatch.map(item => ({
                delegator: item.delegator,
                data: {
                    rewards: item.rewards,
                    fmtversion: 'v20240407'
                },
                timestamp: item.timestamp
            }));

            await queryJsinfo(
                async (db) => db.insert(JsinfoSchema.delegatorRewards)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [JsinfoSchema.delegatorRewards.delegator],
                        set: {
                            data: sql`excluded.data`,
                            timestamp: sql`excluded.timestamp`
                        }
                    }),
                'DelegatorRewardsMonitor::batchInsert'
            );

            logger.info(`DelegatorRewardsMonitor::DB Update - Batch updated rewards`, {
                batchSize: this.rewardsBatch.length,
                delegators: this.rewardsBatch.map(item => item.delegator),
                timestamp: new Date().toISOString()
            });

            // Reset batch
            this.rewardsBatch = [];
            this.lastBatchUpdate = Date.now();

        } catch (error) {
            logger.error(`DelegatorRewardsMonitor::DB Update - Failed to update rewards batch`, {
                error,
                batchSize: this.rewardsBatch.length,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    private async processDelegatorChunk(
        delegators: string[],
        chunkIndex: number,
        totalDelegators: number,
        progressCallback: (processed: number) => void
    ): Promise<void> {
        logger.info(`DelegatorRewardsMonitor - Processing chunk`, {
            thread: chunkIndex + 1,
            chunkSize: delegators.length,
            totalDelegators
        });

        for (const delegator of delegators) {
            try {
                const rewards = await RpcOnDemandEndpointCache.GetDelegatorRewards(delegator);
                const processedRewards: ProcessedRewardAmount[] = [];

                for (const reward of rewards.rewards) {
                    if (reward.provider === delegator) {
                        for (const rewardAmount of reward.amount) {
                            const [amount, denom] = await ConvertToBaseDenom(rewardAmount.amount, rewardAmount.denom);
                            const usdcAmount = await GetUSDCValue(amount, denom);
                            processedRewards.push({
                                amount: Number(amount),
                                denom,
                                usdcValue: parseFloat(usdcAmount),
                                provider: reward.provider
                            });
                        }
                    }
                }

                await this.updateRewardsInDb(delegator, processedRewards);
                progressCallback(1);
            } catch (error) {
                const errorDetails = {
                    thread: chunkIndex + 1,
                    delegator,
                    errorType: typeof error,
                    errorName: (error as Error)?.name,
                    errorMessage: (error as Error)?.message,
                    errorStack: (error as Error)?.stack,
                    fullError: error instanceof Error
                        ? JSON.stringify(error, Object.getOwnPropertyNames(error))
                        : JSON.stringify(error)
                };

                console.error('Full error details:', errorDetails);  // For immediate console debugging
                logger.error(`DelegatorRewardsMonitor - Error processing delegator`, errorDetails);
            }
        }
    }

    public async ProcessDelegatorRewards(): Promise<void> {
        const startTime = Date.now();
        let processedCount = 0;
        let lastLogTime = startTime;
        let lastLogPercent = 0;

        try {
            const delegators = await RpcPeriodicEndpointCache.GetUniqueDelegators();
            const totalDelegators = delegators.length;

            logger.info(`DelegatorRewardsMonitor - Starting rewards processing`, {
                totalDelegators,
                timestamp: new Date().toISOString()
            });

            // Progress tracking
            const updateProgress = (increment: number) => {
                processedCount += increment;
                const currentPercent = Math.floor((processedCount / totalDelegators) * 100);
                const currentTime = Date.now();

                if (currentTime - lastLogTime >= 30000 || currentPercent >= lastLogPercent + 5) {
                    logger.info(`DelegatorRewardsMonitor - Processing progress`, {
                        processed: processedCount,
                        total: totalDelegators,
                        percentComplete: currentPercent,
                        timeElapsedSeconds: (currentTime - lastLogTime) / 1000
                    });
                    lastLogTime = currentTime;
                    lastLogPercent = currentPercent;
                }
            };

            // Process in chunks of 10 delegators
            const chunkSize = 10;
            const chunks = Array.from(
                { length: Math.ceil(delegators.length / chunkSize) },
                (_, i) => delegators.slice(i * chunkSize, (i + 1) * chunkSize)
            );

            // Process chunks sequentially to avoid overwhelming the API
            for (let i = 0; i < chunks.length; i++) {
                await this.processDelegatorChunk(
                    chunks[i],
                    i,
                    totalDelegators,
                    updateProgress
                );
            }

            const totalTime = (Date.now() - startTime) / 1000;
            logger.info(`DelegatorRewardsMonitor - Completed processing`, {
                totalProcessed: processedCount,
                totalDelegators,
                totalTimeSeconds: totalTime
            });

        } catch (error) {
            const totalTime = (Date.now() - startTime) / 1000;
            logger.error(`DelegatorRewardsMonitor - Error in processing`, {
                error,
                totalTimeSeconds: totalTime
            });
            throw error;
        }
    }
}

export const DelegatorRewardsMonitor = new DelegatorRewardsMonitorClass();
