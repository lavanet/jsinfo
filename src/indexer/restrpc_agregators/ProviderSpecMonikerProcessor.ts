// src/indexer/restrpc_agregators/ProviderSpecMoniker.ts

import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "../utils/restRpc";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from 'drizzle-orm';
import { MemoryCache } from "../classes/MemoryCache";
import { SpecAndConsumerCache } from "../classes/IndexerSpecAndConsumerCache";

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

export async function ProcessProviderMonikerSpecs(db: PostgresJsDatabase): Promise<void> {
    console.log('ProcessProviderMonikerSpecs: Starting');
    try {
        const specs = await SpecAndConsumerCache.GetAllSpecs(db);

        for (const spec of specs) {
            const providerResponse = await GetProviderMonikerSpecs(spec);

            for (const provider of providerResponse.stakeEntry) {
                await ProcessProviderMonikerSpec(db, {
                    provider: provider.address,
                    moniker: provider.moniker,
                    spec: spec
                });
            }
        }

        await batchInsert(db);
    } catch (error) {
        console.error('ProviderSpecMonikerProcessor: Error occurred', error);
        logger.error('ProviderSpecMonikerProcessor:: Error processing provider moniker specs', { error });
        throw error;
    }
}

async function ProcessProviderMonikerSpec(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    const { provider, moniker, spec: specValue } = psmEntry;

    if (!IsMeaningfulText(provider) || !IsMeaningfulText(moniker) || !IsMeaningfulText(specValue)) {
        return;
    }

    await batchAppend(db, psmEntry);
}

let batchData: ProviderMonikerSpec[] = [];
let batchStartTime: Date = new Date();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 60000; // 1 minute in milliseconds

async function batchAppend(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    const cacheKey = `providerSpecMoniker-batchAppend-${psmEntry.provider}-${psmEntry.spec}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.moniker === psmEntry.moniker) {
        return;
    }

    batchData.push(psmEntry);

    if (batchData.length >= BATCH_SIZE || Date.now() - batchStartTime.getTime() >= BATCH_INTERVAL) {
        await batchInsert(db);
    }

    await MemoryCache.setDict(cacheKey, { moniker: psmEntry.moniker }, 3600);
}

async function batchInsert(db: PostgresJsDatabase): Promise<void> {
    if (batchData.length === 0) {
        return;
    }

    const uniqueEntriesByProviderSpec = new Map<string, ProviderMonikerSpec>();

    for (const entry of batchData) {
        if (!IsMeaningfulText(entry.moniker) || !IsMeaningfulText(entry.spec)) {
            // console.log(`batchInsert: Skipping entry due to invalid text`, entry);
            continue;
        }
        const key = `${entry.provider.toLowerCase()}-${entry.spec.toLowerCase()}`;
        uniqueEntriesByProviderSpec.set(key, entry);
    }


    try {
        await db.insert(JsinfoSchema.providerSpecMoniker)
            .values(Array.from(uniqueEntriesByProviderSpec.values()))
            .onConflictDoUpdate({
                // TODO:: this is spec on the hypertables branch
                target: [JsinfoSchema.providerSpecMoniker.provider, JsinfoSchema.providerSpecMoniker.specId],
                set: {
                    moniker: sql.raw('EXCLUDED.moniker')
                }
            });

        batchData = [];
        batchStartTime = new Date();
    } catch (error) {
        logger.error('ProviderSpecMonikerProcessor:: Error in batch insert operation', { error });
    }
}


