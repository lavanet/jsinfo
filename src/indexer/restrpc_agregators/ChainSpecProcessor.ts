import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { RpcPeriodicEndpointCache } from "../classes/RpcPeriodicEndpointCache";
import { keyValueStore } from "../../schemas/jsinfoSchema/jsinfoSchema";
import { logger } from "../../utils/utils";
import { eq } from "drizzle-orm";

export async function ProcessChainSpecs(db: PostgresJsDatabase): Promise<void> {
    try {
        const start = Date.now();
        const chainList = await RpcPeriodicEndpointCache.GetChainList();

        const specs = chainList
            .map(chain => chain.chainID.toUpperCase())
            .sort()
            .join(',');

        await db
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
            });

        const executionTime = Date.now() - start;
        logger.info(`Chain specs processed and stored. Count: ${chainList.length}, Execution time: ${executionTime}ms`);
    } catch (error) {
        logger.error('Error processing chain specs', { error });
        throw error;
    }
}