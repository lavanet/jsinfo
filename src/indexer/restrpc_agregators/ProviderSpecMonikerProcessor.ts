import { IsMeaningfulText, logger } from "../../utils/utils";
import { QueryLavaRPC } from "../utils/restRpc";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from 'drizzle-orm';
import { MemoryCache } from "../../indexer/classes/MemoryCache";
import { SpecAndConsumerCache } from "../../query/classes/SpecAndConsumerCache";

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
    return QueryLavaRPC<ProviderResponse>(`/lavanet/lava/pairing/providers/${spec}`);
}

export async function ProcessProviderMonikerSpecs(db: PostgresJsDatabase): Promise<void> {
    try {
        const specs = SpecAndConsumerCache.GetAllSpecs();

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

        // Process any remaining batch data
        await batchInsert(db);
    } catch (error) {
        logger.error('ProviderSpecMoniker:: Error processing provider moniker specs', { error });
        throw error;
    }
}

async function ProcessProviderMonikerSpec(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    const { provider, moniker, spec: specValue } = psmEntry;

    if (!IsMeaningfulText(provider) || !IsMeaningfulText(moniker) || !IsMeaningfulText(specValue)) {
        return;
    }

    batchAppend(db, psmEntry);
}

let batchData: ProviderMonikerSpec[] = [];
let batchStartTime: Date = new Date();
const BATCH_SIZE = 100;
const BATCH_INTERVAL = 60000; // 1 minute in milliseconds

async function batchAppend(db: PostgresJsDatabase, psmEntry: ProviderMonikerSpec): Promise<void> {
    const cacheKey = `providerSpecMoniker-batchAppend-${psmEntry.provider}-${psmEntry.spec}`;

    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.moniker === psmEntry.moniker) {
        // Skip appending duplicate record
        return;
    }

    batchData.push(psmEntry);

    if (batchData.length >= BATCH_SIZE || Date.now() - batchStartTime.getTime() >= BATCH_INTERVAL) {
        await batchInsert(db);
    }

    // Update the cache after appending
    await MemoryCache.setDict(cacheKey, { moniker: psmEntry.moniker }, 3600);
}

async function batchInsert(db: PostgresJsDatabase): Promise<void> {
    if (batchData.length === 0) {
        return;
    }

    const uniqueEntriesByProviderSpec = new Map<string, ProviderMonikerSpec>();

    for (const entry of batchData) {
        uniqueEntriesByProviderSpec.set(entry.provider + entry.spec, entry);
    }

    try {
        // Upsert into provider_spec_moniker table
        await db.insert(JsinfoSchema.providerSpecMoniker)
            .values(Array.from(uniqueEntriesByProviderSpec.values()))
            .onConflictDoUpdate({
                target: [JsinfoSchema.providerSpecMoniker.provider, JsinfoSchema.providerSpecMoniker.specId],
                set: { moniker: sql`${JsinfoSchema.providerSpecMoniker.moniker}` }
            });

        // After successful insert, reset the batch
        batchData = [];
        batchStartTime = new Date();
    } catch (error) {
        logger.error('ProviderSpecMoniker:: Error in batch insert operation', { error });
    }
}

