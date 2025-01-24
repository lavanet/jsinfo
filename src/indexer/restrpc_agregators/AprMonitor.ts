// src/indexer/restrpc_agregators/AprApi.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { logger } from '@jsinfo/utils/logger';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/lavaRpcPeriodicEndpointCache';
import { EstimatedRewardsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { ConvertToBaseDenom, GetUSDCValue } from '../../restRpc/CurrencyConverstionUtils';
import { queryJsinfo } from '@jsinfo/utils/db';
import { HashJson } from '@jsinfo/utils/fmt';
import { sql } from 'drizzle-orm';
import { IsTestnet } from '@jsinfo/utils/env';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';

// Constants
const LAVA_RPC_BENCHMARK_AMOUNT = 10000 * 1000000;
const LAVA_RPC_BENCHMARK_DENOM = "ulava";
const COINGEKO_API_BENCHMARK_AMOUNT = 10000;
const COINGEKO_API_BENCHMARK_DENOM = "lava";

const APR_MAX_ERROR = 10000;
// we had values as 0.0020040648396455474
// was ok for 0.0001 on mainnet
const APR_MIN_WARM = IsTestnet() ? 1e-10 : 0.0000001;

const PERCENTILE = 0.8;

const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"];

export function CalculatePercentile(values: number[], rank: number, caller: string): number {
  const dataLen = values.length;
  if (dataLen === 0 || rank < 0.0 || rank > 1.0) {
    logger.warn('Invalid data for percentile calculation. Returning 0.');
    return 0;
  }

  if (values.length == 1) {
    return values[0];
  }

  for (const value of values) {
    numberStats_addNumber(caller + '::CalculatePercentile:ValuesInput', value);
  }

  // Sort values in ascending order
  values.sort((a, b) => a - b);

  // Calculate the position based on the rank
  const position = Math.floor((dataLen - 1) * rank);
  // logger.info('Calculated position for rank:', position, 'dataLen:', dataLen, 'rank:', rank);

  if (dataLen % 2 === 0) {
    // Interpolate between two middle values
    const lower = values[position];
    const upper = values[position + 1];
    const result = lower + (upper - lower) * rank;
    numberStats_addNumber(caller + '::CalculatePercentile:ValuesOutput', result);
    return result;
  } else {
    const result = values[position];
    numberStats_addNumber(caller + '::CalculatePercentile:ValuesOutput', result);
    return result;
  }
}

const numberStats: Map<string, number[]> = new Map();

function numberStats_addNumber(number_name: string, number: number): void {
  if (!numberStats.has(number_name)) {
    numberStats.set(number_name, []);
  }
  numberStats.get(number_name)!.push(number);
}

function calculateMedian(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

let numberStats_lastPrintTime = 0;
const numberStats_printInterval = 60 * 1000; // 1 minute in milliseconds

function numberStats_printStats(): void {
  const currentTime = Date.now();
  if (currentTime - numberStats_lastPrintTime < numberStats_printInterval) {
    return;
  }

  numberStats.forEach((numbers, number_name) => {
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const avg = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const median = calculateMedian(numbers);

    console.log(`Stats for ${number_name}: Min: ${min}, Max: ${max}, Avg: ${avg}, Median: ${median}`);
  });

  numberStats_lastPrintTime = currentTime;
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
    logger.info('Starting APR Monitor...');
    if (this.intervalId) return; // Prevent multiple intervals

    this.intervalId = setInterval(() => {
      logger.info('Processing APR...');
      this.ProcessAPR().catch(console.error);
    }, 5 * 60 * 1000); // 5 minutes

    // Initial run
    this.ProcessAPR().catch(console.error);
  }

  public stop(): void {
    logger.info('Stopping APR Monitor...');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private lastLogTime = 0;
  private LOG_INTERVAL = 3 * 60 * 1000; // 3 minutes in milliseconds

  // annual precentage rewards 
  public async CalculateAPR(totalReward: number, caller: string): Promise<number> {
    // this number is 932.82 on 04/12/24
    const investedAmount = await GetUSDCValue(COINGEKO_API_BENCHMARK_AMOUNT.toString(), COINGEKO_API_BENCHMARK_DENOM);

    const now = Date.now();
    if (now - this.lastLogTime >= this.LOG_INTERVAL) {
      logger.info(`[APR Monitor] CalculateAPR: usdc value for ${LAVA_RPC_BENCHMARK_AMOUNT} ${LAVA_RPC_BENCHMARK_DENOM} is ${investedAmount}`);
      this.lastLogTime = now;
    }

    const rate = totalReward / parseFloat(investedAmount);

    const apr = ((1 + rate) ** 12 - 1);

    if (apr === Infinity || apr === -Infinity) {
      logger.error(`AprMon: ${caller} - APR is Infinity or -Infinity. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${apr}`);
      return 0;
    }

    if (apr < APR_MIN_WARM) {
      logger.warn(`AprMon: ${caller} - APR is too low. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${apr}`);
      return apr;
    }

    if (apr > APR_MAX_ERROR) {
      logger.warn(`AprMon: ${caller} - APR is too high. Returning 0. Total Reward: ${totalReward}, Invested Amount: ${investedAmount}, Rate: ${rate}, APR: ${apr}`);
      return 0;
    }

    return apr;
  }

  private splitIntoChunks(entities: string[], numChunks: number = 3): string[][] {
    const chunkSize = Math.ceil(entities.length / numChunks);
    return Array.from(
      { length: Math.ceil(entities.length / chunkSize) },
      (_, i) => entities.slice(i * chunkSize, (i + 1) * chunkSize)
    );
  }

  private async enrichLavaAddresssWithUSDCRewards(
    lavaAddresses1: string[],
    chunkIndex: number,
    getEstimatedRewards: (entity: string) => Promise<EstimatedRewardsResponse>,
    totalEntities: number,
    caller: string,
    progressCallback: (processed: number) => void
  ): Promise<Map<string, number>> {

    const lavaAddressesRewards = new Map<string, number>();

    for (const lavaAddress of lavaAddresses1) {
      try {
        const estimatedRewards = await getEstimatedRewards(lavaAddress);

        for (const total of estimatedRewards.total) {
          if (TEST_DENOMS.includes(total.denom)) continue;

          const [amount, denom] = await ConvertToBaseDenom(total.amount, total.denom);
          if (amount === "0") continue;

          const usdcAmount = await GetUSDCValue(amount, denom);
          if (usdcAmount === "0") continue;

          numberStats_addNumber(caller + '::enrichLavaAddresssWithUSDCRewards:RewardUsdcAmount', parseFloat(usdcAmount));
          lavaAddressesRewards.set(lavaAddress, (lavaAddressesRewards.get(lavaAddress) || 0) + parseFloat(usdcAmount));
        }

        progressCallback(1); // Increment processed count by 1
      } catch (error) {
        logger.error(`Error processing entity ${lavaAddress}:`, error);
      }
    }

    for (const [lavaAddress, totalReward] of lavaAddressesRewards.entries()) {
      numberStats_addNumber(caller + '::enrichLavaAddresssWithUSDCRewards:RewardUsdcAmount-Total', totalReward);
    }

    return lavaAddressesRewards;
  }

  private async calcAPRsFromTotalRewards(rewards: Map<string, number>, caller: string): Promise<Map<string, number>> {
    const aprs = new Map<string, number>();
    for (const [lavaAddress, totalReward] of rewards.entries()) {
      if (totalReward === 0) continue;
      const APR = await this.CalculateAPR(totalReward, caller + ":" + lavaAddress);
      if (APR === 0) continue;
      aprs.set(lavaAddress, APR);
    }
    return aprs;
  }

  private async calculateAPROnLavaAddresses(
    getLavaAddresses: () => Promise<string[]>,
    getEstimatedRewards: (address: string) => Promise<EstimatedRewardsResponse>,
    caller: string,
    numThreads: number = 3
  ): Promise<number> {
    const startTime = Date.now();
    let processedCount = 0;
    let lastLogTime = startTime;
    let lastLogPercent = 0;

    try {
      const lavaAddresses = await getLavaAddresses();
      const totalAddresses = lavaAddresses.length;

      // Progress tracking callback
      const updateProgress = (increment: number) => {
        processedCount += increment;
        const currentPercent = Math.floor((processedCount / totalAddresses) * 100);
        const currentTime = Date.now();

        if (currentTime - lastLogTime >= 30000 || currentPercent >= lastLogPercent + 5) {
          if (lavaAddresses.length > 2) {
            logger.info(`AprMon: ${caller} - Processing progress: ${processedCount}/${totalAddresses} (${currentPercent}%)`);
          }
          lastLogTime = currentTime;
          lastLogPercent = currentPercent;
        }
      };

      // Split and process in parallel
      const chunksOfLavaAddresses = this.splitIntoChunks(lavaAddresses, numThreads);
      const lavaAddressesRewards = await Promise.all(
        chunksOfLavaAddresses.map((lavaAddresses, index) =>
          this.enrichLavaAddresssWithUSDCRewards(lavaAddresses, index, getEstimatedRewards, totalAddresses, caller, updateProgress)
        )
      );

      // Merge results from all chunks
      const totalRewards = new Map<string, number>();
      lavaAddressesRewards.forEach(lavaAddressesRewardsItem => {
        lavaAddressesRewardsItem.forEach((usdcRewards, lavaAddress) => {
          totalRewards.set(lavaAddress, (totalRewards.get(lavaAddress) || 0) + usdcRewards);
        });
      });

      if (totalRewards.size === 0) return 0;

      const totalAPRs = await this.calcAPRsFromTotalRewards(totalRewards, caller);
      if (totalAPRs.size === 0) return 0;

      // the for provider flow for the all_providers_apr
      if (!caller.includes('for')) {
        this.SaveFullAprValues(totalAPRs, caller);
      }

      const result = CalculatePercentile(Array.from(totalAPRs.values()), PERCENTILE, caller);

      const totalTime = (Date.now() - startTime) / 1000;
      if (lavaAddresses.length > 2) {
        logger.info(`AprMon: ${caller} - Completed calculation. Total processed: ${processedCount}, Total time: ${totalTime}s, Result: ${result}`);
        // numberStats_printStats();
      }

      return result;
    } catch (error) {
      logger.error(`AprMon: ${caller} - Error in processing APR for entities:`, error);
      throw error;
    }
  }

  private async SaveFullAprValues(aprValues: Map<string, number>, caller: string) {
    if (!aprValues.size) {
      logger.info(`SaveRawAprValues: No raw APR values to save from ${caller}`);
      return;
    }

    try {
      const batchData = Array.from(aprValues.entries()).map(([provider, value]) => ({
        address: provider,
        value: Number(value).toFixed(18),
        timestamp: new Date(),
        type: caller
      }));

      await queryJsinfo(async (db) => {
        const result = await db.insert(JsinfoSchema.aprFullInfo)
          .values(batchData)
          .onConflictDoUpdate({
            target: [JsinfoSchema.aprFullInfo.address, JsinfoSchema.aprFullInfo.type],
            set: {
              value: sql`EXCLUDED.value`,
              timestamp: sql`EXCLUDED.timestamp`
            }
          });
        return result;
      }, `APRMonitor::SaveRawAprValues:${caller}`);

    } catch (error) {
      logger.error('SaveRawAprValues: Error saving raw APR values:', {
        error: error instanceof Error ? error.message : error,
        caller,
        valuesCount: aprValues.size,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private async saveAprToDb(key: string, value: number): Promise<void> {
    logger.info(`Saving APR to DB . key: ${key}, value: ${value}`);
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
        `APRMonitor::saveAprToDb:${key}:${value}`
      );

      logger.info(`Successfully updated ${key} in DB.`);
    } catch (error) {
      logger.error(`Failed to update ${key} in DB:`, error);
      throw error;
    }
  }

  private async doAprPerProviderBatchUpdate(): Promise<void> {
    logger.info('Processing APR per provider update batch...');
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
                value: value.toString(),
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
            return updates;
          });
          return result;
        },
        `APRMonitor::doAprPerProviderBatchUpdate:${HashJson(updates)}`
      );

      logger.info('Successfully updated batch for providers:', updates);
    } catch (error) {
      logger.error('Failed to update batch for providers:', error);
      throw error;
    }
  }

  private startAprPerProviderUpdateTimer(): void {
    logger.info('Starting APR per provider update timer...');
    if (this.aprPerProviderUpdateTimer) return; // Prevent multiple timers

    this.aprPerProviderUpdateTimer = setInterval(() => {
      logger.info('Processing APR per provider update batch...');
      this.doAprPerProviderBatchUpdate().catch(console.error);
    }, 60 * 1000); // 1 minute
  }

  private async saveAprToDbPerProvider(type: string, value: number, estimatedRewards: EstimatedRewardsResponse, provider: string): Promise<void> {
    logger.info(`Adding to APR per provider update batch: type=${type}, value=${value}, provider=${provider}`);
    this.aprPerProviderUpdateBatch.push({ type, value, provider, estimatedRewards }); // Add to the batch

    if (this.aprPerProviderUpdateBatch.length === 1) {
      this.startAprPerProviderUpdateTimer();
    }

    if (this.aprPerProviderUpdateBatch.length >= 100) {
      logger.info('Processing APR per provider update batch immediately due to batch size limit.');
      await this.doAprPerProviderBatchUpdate();
    }
  }

  public async ProcessAPR() {
    logger.info('Starting ProcessAPR...');
    const retry = async (fn: () => Promise<any>, retries: number = 3): Promise<any> => {
      for (let i = 0; i < retries; i++) {
        try {
          return await fn();
        } catch (error: any) {
          logger.warn(`Retrying function due to error: ${error.message}. Attempt ${i + 1} of ${retries}`);
          if (i === retries - 1) throw error;
        }
      }
    };

    try {
      // Start the main process
      const startTime = Date.now();
      logger.info('Main process started.');

      try {
        // Create an array to hold all promises
        const promises: Promise<void>[] = [];

        // 1) Calculate Restaking APR and update the database
        logger.info('Calculating Restaking APR...');
        const providers = await ActiveProvidersService.fetch();
        if (!providers) {
          logger.error('No providers found');
          return;
        }

        promises.push(
          retry(() => this.calculateAPROnLavaAddresses(
            () => Promise.resolve(providers),
            (provider) => RpcOnDemandEndpointCache.GetEstimatedProviderRewards(provider, LAVA_RPC_BENCHMARK_AMOUNT, LAVA_RPC_BENCHMARK_DENOM),
            'Restaking APR'
          )).then(aprRestaking => {
            logger.info('Restaking APR calculated:', aprRestaking);
            return retry(() => this.saveAprToDb('restaking_apr_percentile', aprRestaking));
          })
        );

        // 2) Update APR for each provider concurrently
        const updateRestakingAPR = async () => {
          logger.info('Updating APR for each provider...');
          for (const provider of providers) {
            const estimatedRewards = await RpcOnDemandEndpointCache.GetEstimatedProviderRewards(provider, LAVA_RPC_BENCHMARK_AMOUNT, LAVA_RPC_BENCHMARK_DENOM);
            const apr = await retry(() => this.calculateAPROnLavaAddresses(
              () => Promise.resolve([provider]),
              (provider) => Promise.resolve(estimatedRewards),
              `Restaking APR for ${provider}`
            ));
            promises.push(this.saveAprToDbPerProvider('restaking', apr, estimatedRewards, provider));
          }
        };

        promises.push(updateRestakingAPR());

        // 3) Calculate Staking APR and update the database
        promises.push(
          retry(() => this.calculateAPROnLavaAddresses(
            () => RpcPeriodicEndpointCache.GetAllActiveValidatorsAddresses(),
            (validator) => RpcOnDemandEndpointCache.GetEstimatedValidatorRewards(validator, LAVA_RPC_BENCHMARK_AMOUNT, LAVA_RPC_BENCHMARK_DENOM),
            'Staking APR',
            6
          )).then(aprStaking => {
            return retry(() => this.saveAprToDb('staking_apr_percentile', aprStaking));
          })
        );

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

