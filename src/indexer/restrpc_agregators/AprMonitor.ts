// src/indexer/restrpc_agregators/AprApi.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { logger } from '@jsinfo/utils/logger';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/RpcPeriodicEndpointCache';
import { EstimatedRewardsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/RpcOnDemandEndpointCache';
import { ConvertToBaseDenom, GetUSDCValue } from './CurrencyConverstionUtils';
import { queryJsinfo } from '@jsinfo/utils/db';
import { HashJson } from '@jsinfo/utils/fmt';
import { sql } from 'drizzle-orm';

// Constants
const BENCHMARK_AMOUNT = 10_000_000_000;
const BENCHMARK_DENOM = "ulava";
const PERCENTILE = 0.8;

const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"];

export function CalculatePercentile(values: number[], rank: number): number {
  const dataLen = values.length;
  if (dataLen === 0 || rank < 0.0 || rank > 1.0) {
    return 0;
  }

  // Sort values in ascending order
  values.sort((a, b) => a - b);

  // Calculate the position based on the rank
  const position = Math.floor((dataLen - 1) * rank);

  if (dataLen % 2 === 0) {
    // Interpolate between two middle values
    const lower = values[position];
    const upper = values[position + 1];
    return lower + (upper - lower) * rank;
  } else {
    return values[position];
  }
}

interface AprPerProviderUpdateBatch {
  type: string;
  value: number;
  provider: string;
  estimatedRewards: EstimatedRewardsResponse;
}

class APRMonitorClass {
  private intervalId: NodeJS.Timer | null = null;
  private aprPerProviderUpdateBatch: AprPerProviderUpdateBatch[] = [];
  private aprPerProviderUpdateTimer: any | null = null;

  public start(): void {
    if (this.intervalId) return; // Prevent multiple intervals

    this.intervalId = setInterval(() => {
      this.ProcessAPR().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutes

    // Initial run
    this.ProcessAPR().catch(console.error);
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public async CalculateAPR(totalReward: number): Promise<number> {
    const investedAmount = await GetUSDCValue((BENCHMARK_AMOUNT / 1000000).toString(), "lava");
    const rate = totalReward / parseFloat(investedAmount);
    const APR = ((1 + rate) ** 12 - 1)
    return APR
  }

  private splitIntoChunks(entities: string[], numChunks: number = 3): string[][] {
    const chunkSize = Math.ceil(entities.length / numChunks);
    return Array.from(
      { length: Math.ceil(entities.length / chunkSize) },
      (_, i) => entities.slice(i * chunkSize, (i + 1) * chunkSize)
    );
  }

  private async processEntityChunk(
    chunk: string[],
    chunkIndex: number,
    getEstimatedRewards: (entity: string) => Promise<EstimatedRewardsResponse>,
    totalEntities: number,
    caller: string,
    progressCallback: (processed: number) => void
  ): Promise<Map<string, number>> {
    const chunkRewards = new Map<string, number>();

    logger.info(`APRMonitor::${caller} - Starting chunk processing`, {
      thread: chunkIndex + 1,
      chunkSize: chunk.length,
      totalEntities
    });

    for (const entity of chunk) {
      try {
        const estimatedRewards = await getEstimatedRewards(entity);

        for (const total of estimatedRewards.total) {
          if (TEST_DENOMS.includes(total.denom)) continue;

          const [amount, denom] = await ConvertToBaseDenom(total.amount, total.denom);
          const usdcAmount = await GetUSDCValue(amount, denom);
          chunkRewards.set(entity, (chunkRewards.get(entity) || 0) + parseFloat(usdcAmount));
        }

        progressCallback(1); // Increment processed count by 1
      } catch (error) {
        logger.error(`APRMonitor::${caller} - Error processing entity`, {
          thread: chunkIndex + 1,
          entity,
          error
        });
      }
    }

    logger.info(`APRMonitor::${caller} - Completed chunk processing`, {
      thread: chunkIndex + 1,
      processedEntities: chunk.length
    });

    return chunkRewards;
  }

  private async calculateAPRs(rewards: Map<string, number>): Promise<Map<string, number>> {
    const aprs = new Map<string, number>();
    for (const [entityId, totalReward] of rewards.entries()) {
      const APR = await this.CalculateAPR(totalReward);
      aprs.set(entityId, APR);
    }
    return aprs;
  }

  private async calculateAPRForEntities(
    getEntities: () => Promise<string[]>,
    getEstimatedRewards: (entity: string) => Promise<EstimatedRewardsResponse>,
    caller: string,
    numThreads: number = 3
  ): Promise<number> {
    const startTime = Date.now();
    let processedCount = 0;
    let lastLogTime = startTime;
    let lastLogPercent = 0;


    try {
      const entities = await getEntities();
      const totalEntities = entities.length;

      // Progress tracking callback
      const updateProgress = (increment: number) => {
        processedCount += increment;
        const currentPercent = Math.floor((processedCount / totalEntities) * 100);
        const currentTime = Date.now();

        if (currentTime - lastLogTime >= 30000 || currentPercent >= lastLogPercent + 5) {
          logger.info(`APRMonitor::${caller} - Processing progress`, {
            processed: processedCount,
            total: totalEntities,
            percentComplete: currentPercent,
            timeElapsedSeconds: (currentTime - lastLogTime) / 1000,
            activeThreads: numThreads
          });
          lastLogTime = currentTime;
          lastLogPercent = currentPercent;
        }
      };

      // Split and process in parallel
      const chunks = this.splitIntoChunks(entities, numThreads);
      const chunkResults = await Promise.all(
        chunks.map((chunk, index) =>
          this.processEntityChunk(chunk, index, getEstimatedRewards, totalEntities, caller, updateProgress)
        )
      );

      // Merge results from all chunks
      const totalRewards = new Map<string, number>();
      chunkResults.forEach(chunkRewards => {
        chunkRewards.forEach((value, key) => {
          totalRewards.set(key, (totalRewards.get(key) || 0) + value);
        });
      });

      // Calculate APRs and final result
      const totalAPRs = await this.calculateAPRs(totalRewards);
      const result = CalculatePercentile(Array.from(totalAPRs.values()), PERCENTILE);

      const totalTime = (Date.now() - startTime) / 1000;
      logger.info(`APRMonitor::${caller} - Completed calculation`, {
        totalProcessed: processedCount,
        totalEntities,
        totalTimeSeconds: totalTime,
        result
      });

      return result;
    } catch (error) {
      const totalTime = (Date.now() - startTime) / 1000;
      logger.error(`APRMonitor::${caller} - Error in processing`, {
        error,
        totalTimeSeconds: totalTime
      });
      throw error;
    }
  }

  private async updateAprInDb(key: string, value: number): Promise<void> {
    try {
      const now = new Date();
      await queryJsinfo(
        async (db) => {
          const result = await db.transaction(async (tx) => {
            await tx.insert(JsinfoSchema.apr)
              .values({
                key,
                value,
                timestamp: now
              } as any)
              .onConflictDoUpdate({
                target: [JsinfoSchema.apr.key],
                set: {
                  value,
                  timestamp: now,
                } as any
              });
            return { key, value, timestamp: now };
          });
          return result;
        },
        `APRMonitor::updateAprInDb:${key}:${value}`
      );

      logger.info(`APRMonitor::DB Update - Successfully updated ${key}`, {
        value,
        timestamp: now.toISOString()
      });
    } catch (error) {
      logger.error(`APRMonitor::DB Update - Failed to update ${key}`, {
        error,
        value,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private async processaprPerProviderUpdateBatch(): Promise<void> {
    if (this.aprPerProviderUpdateBatch.length === 0) return;

    const now = new Date();
    const updates = this.aprPerProviderUpdateBatch.splice(0, this.aprPerProviderUpdateBatch.length); // Clear the batch

    try {
      await queryJsinfo(
        async (db) => {
          const result = await db.transaction(async (tx) => {
            // Perform batch insert
            await tx.insert(JsinfoSchema.aprPerProvider)
              .values(updates.map(({ type, value, provider, estimatedRewards }) => ({
                type,
                value,
                timestamp: now,
                provider,
                estimatedRewards,
              })))
              .onConflictDoUpdate({
                target: [JsinfoSchema.aprPerProvider.provider, JsinfoSchema.aprPerProvider.type],
                set: {
                  value: sql`EXCLUDED.value`, // Use the new value
                  timestamp: now,
                  estimatedRewards: sql`EXCLUDED.estimated_rewards`,
                } as any
              });
            return updates; // Return the updates for logging
          });
          return result;
        },
        `APRMonitor::processaprPerProviderUpdateBatch:${HashJson(updates)}`
      );

      logger.info(`APRMonitor::DB Update - Successfully updated batch for providers`, {
        updates,
        timestamp: now.toISOString()
      });
    } catch (error) {
      logger.error(`APRMonitor::DB Update - Failed to update batch for providers`, {
        error,
        updates,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private startAprPerProviderUpdateTimer(): void {
    if (this.aprPerProviderUpdateTimer) return; // Prevent multiple timers

    this.aprPerProviderUpdateTimer = setInterval(() => {
      this.processaprPerProviderUpdateBatch().catch(console.error);
    }, 60 * 1000); // 1 minute
  }

  private async updateAprInDbPerProvider(type: string, value: number, estimatedRewards: EstimatedRewardsResponse, provider: string): Promise<void> {
    this.aprPerProviderUpdateBatch.push({ type, value, provider, estimatedRewards }); // Add to the batch

    logger.info(`APRMonitor::Batch Update - Current batch size: ${this.aprPerProviderUpdateBatch.length}, Type: ${type}, Provider: ${provider}`);

    if (this.aprPerProviderUpdateBatch.length === 1) {
      this.startAprPerProviderUpdateTimer(); // Start the timer on the first item
    }

    if (this.aprPerProviderUpdateBatch.length >= 100) {
      await this.processaprPerProviderUpdateBatch(); // Process immediately if batch size reaches 100
    }
  }

  public async ProcessAPR() {

    const retry = async (fn: () => Promise<any>, retries: number = 3): Promise<any> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error) {
          if (i === retries - 1) throw error; // Rethrow if no retries left
        }
      }
    };

    try {
      // Start the main process
      const startTime = Date.now();

      try {
        // Create an array to hold all promises
        const promises: Promise<void>[] = [];

        // 1) Calculate Restaking APR and update the database
        promises.push(
          retry(() => this.calculateAPRForEntities(
            () => RpcPeriodicEndpointCache.GetProviders(),
            (provider) => RpcOnDemandEndpointCache.GetEstimatedProviderRewards(provider, BENCHMARK_AMOUNT, BENCHMARK_DENOM),
            'Restaking APR'
          )).then(aprRestaking => {
            return retry(() => this.updateAprInDb('restaking_apr_percentile', aprRestaking));
          })
        );

        // 2) Update APR for each provider concurrently
        const updateRestakingAPR = async () => {
          const providers = await RpcPeriodicEndpointCache.GetProviders();
          for (const provider of providers) {
            const estimatedRewards = await RpcOnDemandEndpointCache.GetEstimatedProviderRewards(provider, BENCHMARK_AMOUNT, BENCHMARK_DENOM);
            const apr = await retry(() => this.calculateAPRForEntities(
              () => Promise.resolve([provider]),
              (provider) => Promise.resolve(estimatedRewards),
              `Restaking APR for ${provider}`
            ));
            promises.push(this.updateAprInDbPerProvider('restaking', apr, estimatedRewards, provider));
          }
        };

        promises.push(updateRestakingAPR()); // Call the function and push the promise

        // 3) Calculate Staking APR and update the database
        promises.push(
          retry(() => this.calculateAPRForEntities(
            () => RpcPeriodicEndpointCache.GetAllValidators(),
            (validator) => RpcOnDemandEndpointCache.GetEstimatedValidatorRewards(validator, BENCHMARK_AMOUNT, BENCHMARK_DENOM),
            'Staking APR',
            6
          )).then(aprStaking => {
            return retry(() => this.updateAprInDb('staking_apr_percentile', aprStaking));
          })
        );

        // 4) Update APR for each validator concurrently
        const updateValidatorAPR = async () => {
          const validators = await RpcPeriodicEndpointCache.GetAllValidators();
          for (const validator of validators) {
            const estimatedRewards = await RpcOnDemandEndpointCache.GetEstimatedValidatorRewards(validator, BENCHMARK_AMOUNT, BENCHMARK_DENOM);
            const apr = await retry(() => this.calculateAPRForEntities(
              () => Promise.resolve([validator]),
              (validator) => Promise.resolve(estimatedRewards),
              `Staking APR for ${validator}`
            ));
            promises.push(this.updateAprInDbPerProvider('staking', apr, estimatedRewards, validator));
          }
        };

        promises.push(updateValidatorAPR()); // Call the function and push the promise

        // Wait for all promises to complete
        await Promise.all(promises);

        // Log the processing time
        const processingTime = (Date.now() - startTime) / 1000;
        logger.info('APRMonitor::Staking - Completed full process', {
          processingTimeSeconds: processingTime
        });
      } catch (error) {
        logger.error('APRMonitor::ProcessAPR - Error during processing', { error });
      }
    } catch (error) {
      logger.error('APRMonitor::ProcessAPR - Error during processing', { error });
    }
  }

}

export const APRMonitor = new APRMonitorClass();

