// src/indexer/restrpc_agregators/ProviderSpecMoniker.ts

import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "./utils";
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
    console.log(`GetProviderMonikerSpecs: Querying for spec ${spec}`);
    const response = await QueryLavaRPC<ProviderResponse>(`/lavanet/lava/pairing/providers/${spec}`);
    console.log(`GetProviderMonikerSpecs: Received response for spec ${spec}`, { providerCount: response.stakeEntry.length });
    return response;
}

export async function ProcessProviderMonikerSpecs(db: PostgresJsDatabase): Promise<void> {
    console.log('ProcessProviderMonikerSpecs: Starting');
    try {
        const specs = await SpecAndConsumerCache.GetAllSpecs(db);
        console.log(`ProcessProviderMonikerSpecs: Retrieved ${specs.length} specs`);

        for (const spec of specs) {
            console.log(`ProcessProviderMonikerSpecs: Processing spec ${spec}`);
            const providerResponse = await GetProviderMonikerSpecs(spec);

            for (const provider of providerResponse.stakeEntry) {
                console.log(`ProcessProviderMonikerSpecs: Processing provider ${provider.address} for spec ${spec}`);
                await ProcessProviderMonikerSpec(db, {
                    provider: provider.address,
                    moniker: provider.moniker,
                    spec: spec
                });
            }
        }

        console.log('ProcessProviderMonikerSpecs: Processing remaining batch data');
        await batchInsert(db);
        console.log('ProcessProviderMonikerSpecs: Completed');
    } catch (error) {
        console.error('ProcessProviderMonikerSpecs: Error occurred', error);
        logger.error('ProviderSpecMoniker:: Error processing provider moniker specs', { error });
        throw error;
    }
}

async function ProcessProviderMonikerSpec(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    console.log(`ProcessProviderMonikerSpec: Processing entry`, psmEntry);
    const { provider, moniker, spec: specValue } = psmEntry;

    if (!IsMeaningfulText(provider) || !IsMeaningfulText(moniker) || !IsMeaningfulText(specValue)) {
        console.log(`ProcessProviderMonikerSpec: Skipping entry due to invalid text`, psmEntry);
        return;
    }

    await batchAppend(db, psmEntry);
}

let batchData: ProviderMonikerSpec[] = [];
let batchStartTime: Date = new Date();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 60000; // 1 minute in milliseconds

async function batchAppend(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    console.log(`batchAppend: Appending entry`, psmEntry);
    const cacheKey = `providerSpecMoniker-batchAppend-${psmEntry.provider}-${psmEntry.spec}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.moniker === psmEntry.moniker) {
        console.log(`batchAppend: Skipping duplicate record`, psmEntry);
        return;
    }

    batchData.push(psmEntry);
    console.log(`batchAppend: Current batch size: ${batchData.length}`);

    if (batchData.length >= BATCH_SIZE || Date.now() - batchStartTime.getTime() >= BATCH_INTERVAL) {
        console.log(`batchAppend: Triggering batch insert`);
        await batchInsert(db);
    }

    console.log(`batchAppend: Updating cache for`, psmEntry);
    await MemoryCache.setDict(cacheKey, { moniker: psmEntry.moniker }, 3600);
}

async function batchInsert(db: PostgresJsDatabase): Promise<void> {
    console.log(`batchInsert: Starting with ${batchData.length} entries`);
    if (batchData.length === 0) {
        console.log(`batchInsert: No data to insert, returning`);
        return;
    }

    const uniqueEntriesByProviderSpec = new Map<string, ProviderMonikerSpec>();

    for (const entry of batchData) {
        if (!IsMeaningfulText(entry.moniker) || !IsMeaningfulText(entry.spec)) {
            console.log(`batchInsert: Skipping entry due to invalid text`, entry);
            continue;
        }
        const key = `${entry.provider.toLowerCase()}-${entry.spec.toLowerCase()}`;
        uniqueEntriesByProviderSpec.set(key, entry);
    }

    console.log(`batchInsert: Unique entries count: ${uniqueEntriesByProviderSpec.size}`);

    try {
        console.log(`batchInsert: Attempting upsert operation`);
        await db.insert(JsinfoSchema.providerSpecMoniker)
            .values(Array.from(uniqueEntriesByProviderSpec.values()))
            .onConflictDoUpdate({
                target: [JsinfoSchema.providerSpecMoniker.provider, JsinfoSchema.providerSpecMoniker.spec],
                set: {
                    moniker: sql.raw('EXCLUDED.moniker')
                }
            });

        console.log(`batchInsert: Upsert operation successful`);
        batchData = [];
        batchStartTime = new Date();
        console.log(`batchInsert: Batch data reset`);
    } catch (error) {
        console.error(`batchInsert: Error occurred during upsert`, error);
        logger.error('ProviderSpecMoniker:: Error in batch insert operation', { error });
    }
}


