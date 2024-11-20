import { GetJsinfoDbForIndexer } from '@jsinfo/utils/db';
import { logger } from '@jsinfo/utils/logger';
import { RpcOnDemandEndpointCache } from '@jsinfo/indexer/classes/RpcOnDemandEndpointCache';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { SpecAndConsumerService } from "@jsinfo/redis/resources/global/SpecAndConsumerResource";
import { sql } from 'drizzle-orm';
import { queryJsinfo } from '@jsinfo/utils/dbPool';

export interface ProcessedSpecInfo {
    provider: string;
    chain_id: string;
    total: string;
    totalAdjusted: string;
    iprpc_cu: string;
}

class SpecTrackedInfoMonitorClass {
    private intervalId: NodeJS.Timer | null = null;
    private readonly UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes

    public start(): void {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.ProcessSpecTrackedInfo().catch(console.error);
        }, this.UPDATE_INTERVAL);

        // Initial run
        this.ProcessSpecTrackedInfo().catch(console.error);
    }

    public stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private async updateSpecInfoInDb(specInfo: ProcessedSpecInfo[]): Promise<void> {
        try {
            if (specInfo.length === 0) {
                logger.info('SpecTrackedInfoMonitor::DB Update - No spec info to update');
                return;
            }

            // Deduplicate by provider (taking the last occurrence)
            const deduplicatedInfo = Object.values(
                specInfo.reduce<Record<string, ProcessedSpecInfo>>((acc, info) => ({
                    ...acc,
                    [info.provider]: info
                }), {})
            );

            const db = await GetJsinfoDbForIndexer();
            const now = new Date();

            await queryJsinfo(
                async (db) => db.insert(JsinfoSchema.specTrackedInfo)
                    .values(deduplicatedInfo.map(info => ({
                        provider: info.provider,
                        chain_id: info.chain_id,
                        iprpc_cu: info.iprpc_cu,
                        timestamp: now
                    })))
                    .onConflictDoUpdate({
                        target: [JsinfoSchema.specTrackedInfo.provider, JsinfoSchema.specTrackedInfo.chain_id],
                        set: {
                            iprpc_cu: sql`EXCLUDED.iprpc_cu`,
                            timestamp: sql`EXCLUDED.timestamp`
                        }
                    });

        } catch (error) {
            logger.error(`SpecTrackedInfoMonitor::DB Update - Failed to update spec info`, { error });
            throw error;
        }
    }

    public async ProcessSpecTrackedInfo(): Promise<void> {
        const startTime = Date.now();

        try {
            const db = await GetJsinfoDbForIndexer();
            const specs = await SpecAndConsumerService.GetAllSpecs();
            logger.info(`SpecTrackedInfoMonitor - Processing specs`, { specCount: specs.length });

            const allProcessedInfo: ProcessedSpecInfo[] = [];

            for (const spec of specs) {
                const specTrackedInfo = await RpcOnDemandEndpointCache.GetSpecTrackedInfo(spec);
                // logger.info(`SpecTrackedInfoMonitor - Got spec info`, {
                //     spec,
                //     infoCount: specTrackedInfo.info.length
                // });

                allProcessedInfo.push(...specTrackedInfo.info.map(info => ({
                    provider: info.provider,
                    chain_id: info.chain_id,
                    total: info.base_pay.total,
                    totalAdjusted: info.base_pay.totalAdjusted,
                    iprpc_cu: info.base_pay.iprpc_cu
                })));
            }

            logger.info(`SpecTrackedInfoMonitor - Collected all info`, {
                totalInfoCount: allProcessedInfo.length
            });

            await this.updateSpecInfoInDb(allProcessedInfo);

            const totalTime = (Date.now() - startTime) / 1000;
            logger.info(`SpecTrackedInfoMonitor - Completed processing`, {
                totalProcessed: allProcessedInfo.length,
                totalTimeSeconds: totalTime
            });

        } catch (error) {
            const totalTime = (Date.now() - startTime) / 1000;
            logger.error(`SpecTrackedInfoMonitor - Error in processing`, {
                error,
                totalTimeSeconds: totalTime
            });
            throw error;
        }
    }
}

export const SpecTrackedInfoMonitor = new SpecTrackedInfoMonitorClass();
