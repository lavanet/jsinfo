// src/indexer/restrpc_agregators/ProviderSpecMoniker.ts

import { HashJson, IsMeaningfulText } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/indexer/utils/restRpc';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { sql } from 'drizzle-orm';
import { MemoryCache } from "@jsinfo/indexer/classes/MemoryCache";
import { SpecAndConsumerService } from "@jsinfo/redis/resources/global/SpecAndConsumerResource";
import { queryJsinfo } from '@jsinfo/utils/db';

interface ProviderMonikerSpec {
    provider: string;
    moniker: string;
    spec: string;
}

interface ProviderResponse {
    stakeEntry: Array<{
        address: string;
        moniker: string;
        endpoints: Array<{
            iPPORT: string;
            geolocation: number;
            addons: string[];
            api_interfaces: string[];
            extensions: string[];
        }>;
    }>;
}

export async function GetProviderMonikerSpecs(spec: string): Promise<ProviderResponse> {
    return await QueryLavaRPC<ProviderResponse>(`/lavanet/lava/pairing/providers/${spec}`);
}

export async function ProcessProviderMonikerSpecs(): Promise<void> {
    try {
        const specs = await SpecAndConsumerService.GetAllSpecs();
        for (const spec of specs) {
            const providerResponse = await GetProviderMonikerSpecs(spec);
            for (const provider of providerResponse.stakeEntry) {
                const psmEntry = {
                    provider: provider.address,
                    moniker: provider.moniker,
                    spec: spec
                };

                if (!IsMeaningfulText(psmEntry.provider) || !IsMeaningfulText(psmEntry.moniker) || !IsMeaningfulText(psmEntry.spec)) {
                    continue;
                }

                await batchAppend(psmEntry);
            }
        }

        await batchInsert();
    } catch (error) {
        logger.error('ProcessProviderMonikerSpecs: Error processing provider moniker specs', { error });
        throw error;
    }
}

let batchData: ProviderMonikerSpec[] = [];
let batchStartTime: Date = new Date();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 60000; // 1 minute in milliseconds

async function batchAppend(psmEntry: ProviderMonikerSpec): Promise<void> {
    const cacheKey = `providerSpecMoniker-batchAppend-${psmEntry.provider}-${psmEntry.spec}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.moniker === psmEntry.moniker) {
        return;
    }

    batchData.push(psmEntry);

    if (batchData.length >= BATCH_SIZE || Date.now() - batchStartTime.getTime() >= BATCH_INTERVAL) {
        await batchInsert();
    }

    await MemoryCache.setDict(cacheKey, { moniker: psmEntry.moniker }, 3600);
}

async function batchInsert(): Promise<void> {
    if (batchData.length === 0) {
        logger.warn('providerSpecMoniker:: batchInsert: No data to insert');
        return;
    }

    logger.info(`providerSpecMoniker:: batchInsert: Processing ${batchData.length} entries`);
    const uniqueEntriesByProviderSpec = new Map<string, ProviderMonikerSpec>();

    for (const entry of batchData) {
        if (!IsMeaningfulText(entry.moniker) || !IsMeaningfulText(entry.spec)) {
            // cconsole.log(`batchInsert: Skipping invalid entry for provider ${entry.provider}`);
            continue;
        }
        const key = `${entry.provider.toLowerCase()}-${entry.spec.toLowerCase()}`;
        uniqueEntriesByProviderSpec.set(key, {
            provider: entry.provider.toLowerCase(),
            spec: entry.spec.toLowerCase(),
            moniker: entry.moniker
        });
    }
    try {
        await queryJsinfo(
            async (db) => db.insert(JsinfoSchema.providerSpecMoniker)
                .values(Array.from(uniqueEntriesByProviderSpec.values()))
                .onConflictDoUpdate({
                    target: [JsinfoSchema.providerSpecMoniker.provider, JsinfoSchema.providerSpecMoniker.spec],
                    set: {
                        moniker: sql.raw('EXCLUDED.moniker'),
                    }
                }),
            `ProviderSpecMonikerProcessor::batchInsert:${HashJson(batchData)}`
        );

        batchData = [];
        batchStartTime = new Date();
    } catch (error) {
        logger.error('ProviderSpecMonikerProcessor:: batchInsert: Error in batch insert operation', { error });
    }
}


