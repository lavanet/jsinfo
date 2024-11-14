// src/indexer/restrpc_agregators/AprApi.ts

import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { CalculatePercentile } from "./DataProcessingUtils";
import { logger } from '../../utils/utils';

import { RpcPeriodicEndpointCache } from '../classes/RpcPeriodicEndpointCache';
import { EstimatedRewardsResponse, RpcOnDemandEndpointCache } from '../classes/RpcOnDemandEndpointCache';

import { GetJsinfoDbForIndexer } from "../../utils/dbUtils";
import { ConvertToBaseDenom, GetUSDCValue } from './CurrencyConverstionUtils';

// Constants
const BENCHMARK_AMOUNT = 10_000_000_000;
const BENCHMARK_DENOM = "ulava";
const PERCENTILE = 0.8;

const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"];

class APRMonitorClass {
  private intervalId: NodeJS.Timer | null = null;

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

      logger.info(`APRMonitor::${caller} - Starting calculation`, {
        totalEntities,
        numThreads,
        timestamp: new Date().toISOString()
      });

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
      const db = await GetJsinfoDbForIndexer();
      const now = new Date();

      await db.transaction(async (tx) => {
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
      });

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

  public async ProcessRestakingAPR(): Promise<void> {
    const startTime = Date.now();
    try {
      const apr = await this.calculateAPRForEntities(
        () => RpcPeriodicEndpointCache.GetProviders(),
        (provider) => RpcOnDemandEndpointCache.GetEstimatedProviderRewards(provider, BENCHMARK_AMOUNT, BENCHMARK_DENOM),
        'Restaking APR'
      );

      await this.updateAprInDb('restaking_apr_percentile', apr);

      const processingTime = (Date.now() - startTime) / 1000;
      logger.info('APRMonitor::Restaking - Completed full process', {
        processingTimeSeconds: processingTime,
        apr
      });
    } catch (error) {
      logger.error('APRMonitor::Restaking - Failed processing', {
        error,
        processingTimeSeconds: (Date.now() - startTime) / 1000
      });
      throw error;
    }
  }

  public async ProcessStakingAPR(): Promise<void> {
    const startTime = Date.now();
    try {
      const apr = await this.calculateAPRForEntities(
        () => RpcPeriodicEndpointCache.GetAllValidators(),
        (validator) => RpcOnDemandEndpointCache.GetEstimatedValidatorRewards(validator, BENCHMARK_AMOUNT, BENCHMARK_DENOM),
        'Staking APR',
        6
      );

      await this.updateAprInDb('staking_apr_percentile', apr);

      const processingTime = (Date.now() - startTime) / 1000;
      logger.info('APRMonitor::Staking - Completed full process', {
        processingTimeSeconds: processingTime,
        apr
      });
    } catch (error) {
      logger.error('APRMonitor::Staking - Failed processing', {
        error,
        processingTimeSeconds: (Date.now() - startTime) / 1000
      });
      throw error;
    }
  }

  public async ProcessAPR(): Promise<void> {
    logger.info('APRMonitor::Processing - Starting both APR calculations');

    // Run both processes independently
    Promise.all([
      this.ProcessRestakingAPR().catch(error => {
        logger.error('APRMonitor::Processing - Restaking APR failed', { error });
      }),
      this.ProcessStakingAPR().catch(error => {
        logger.error('APRMonitor::Processing - Staking APR failed', { error });
      })
    ]).catch(error => {
      logger.error('APRMonitor::Processing - Unexpected error in Promise.all', { error });
    });
  }
}

export const APRMonitor = new APRMonitorClass();

