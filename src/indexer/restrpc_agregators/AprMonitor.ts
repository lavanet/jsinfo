// src/indexer/restrpc_agregators/AprApi.ts

import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { logger } from '@jsinfo/utils/logger';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';
import { EstimatedRewardsResponse, RpcOnDemandEndpointCache } from '@jsinfo/restRpc/LavaRpcOnDemandEndpointCache';
import { ConvertToBaseDenom, GetUSDCValue } from '../../restRpc/CurrencyConverstionUtils';
import { queryJsinfo } from '@jsinfo/utils/db';
import { sql } from 'drizzle-orm';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import Decimal from 'decimal.js';
import { CalculateApr, CalculatePercentile, LAVA_RPC_BENCHMARK_AMOUNT, LAVA_RPC_BENCHMARK_DENOM, PERCENTILE, TEST_DENOMS } from './CalcualteApr';

export class APRMonitorClass {
  private intervalId: NodeJS.Timer | null = null;

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

  private splitIntoChunks(entities: string[], numChunks: number = 3): string[][] {
    const chunkSize = Math.ceil(entities.length / numChunks);
    return Array.from(
      { length: Math.ceil(entities.length / chunkSize) },
      (_, i) => entities.slice(i * chunkSize, (i + 1) * chunkSize)
    );
  }

  private async enrichLavaAddresssWithUSDCRewards(
    lavaAddresses1: string[],
    getEstimatedRewards: (entity: string) => Promise<EstimatedRewardsResponse>,
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

          // Use Decimal for precise addition
          const currentAmount = lavaAddressesRewards.get(lavaAddress) || 0;
          const newAmount = new Decimal(currentAmount).plus(new Decimal(usdcAmount)).toNumber();
          lavaAddressesRewards.set(lavaAddress, newAmount);
        }

        progressCallback(1);
      } catch (error) {
        logger.error(`Error processing entity ${lavaAddress}:`, error);
      }
    }

    return lavaAddressesRewards;
  }

  private async calcAPRsFromTotalRewards(rewards: Map<string, number>, caller: string): Promise<Map<string, number>> {
    const aprs = new Map<string, number>();
    for (const [lavaAddress, totalReward] of rewards.entries()) {
      if (totalReward === 0) continue;
      const APR = await CalculateApr(totalReward, caller + ":" + lavaAddress);
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
        chunksOfLavaAddresses.map((lavaAddresses) =>
          this.enrichLavaAddresssWithUSDCRewards(
            lavaAddresses,
            getEstimatedRewards,
            updateProgress
          )
        )
      );

      // Merge results from all chunks
      const totalRewards = new Map<string, number>();
      lavaAddressesRewards.forEach(lavaAddressesRewardsItem => {
        lavaAddressesRewardsItem.forEach((usdcRewards, lavaAddress) => {
          // Use Decimal for precise addition
          const currentTotal = totalRewards.get(lavaAddress) || 0;
          const newTotal = new Decimal(currentTotal).plus(new Decimal(usdcRewards)).toNumber();
          totalRewards.set(lavaAddress, newTotal);
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

        // 2) Calculate Staking APR and update the database
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
