import { RpcPeriodicEndpointCache } from "../classes/RpcPeriodicEndpointCache";
import { keyValueStore } from "@jsinfo/schemas/jsinfoSchema/jsinfoSchema";
import { logger } from "@jsinfo/utils/logger";
import { eq } from "drizzle-orm";
import { queryJsinfo } from "@jsinfo/utils/db";

export async function ProcessChainSpecs(): Promise<void> {
    try {
        const start = Date.now();
        const chainList = await RpcPeriodicEndpointCache.GetChainList();

        const specs = chainList
            .map(chain => chain.chainID.toUpperCase())
            .sort()
            .join(',');

        await queryJsinfo(db => db
            .insert(keyValueStore)
            .values({
                key: 'specs',
                value: specs,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: keyValueStore.key,
                set: {
                    value: specs,
                    updatedAt: new Date(),
                },
                where: eq(keyValueStore.key, 'specs')
            }),
            `ChainSpecProcessor::processChainSpecs:${specs}`
        );

        const executionTime = Date.now() - start;
        logger.info(`Chain specs processed and stored. Count: ${chainList.length}, Execution time: ${executionTime}ms`);
    } catch (error) {
        logger.error('Error processing chain specs', { error });
        throw error;
    }
}