// src/indexer/indexerConsts.ts

import { GetEnvVar } from '@jsinfo/utils/env';
import { ParseSizeToBytes } from '@jsinfo/indexer/utils/indexerUtils';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export const JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE: number = parseInt(GetEnvVar('JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE', "20"));
export const JSINFO_INDEXER_LAVA_RPC: string = GetEnvVar("JSINFO_INDEXER_LAVA_RPC", "https://lav1.tendermintrpc.lava.build/"); // testnet
export const JSINFO_INDEXER_LAVA_REST_RPC_URL: string = GetEnvVar("JSINFO_INDEXER_LAVA_REST_RPC_URL", "https://lav1.lava.build/"); // testnet
export const JSINFO_INDEXER_N_WORKERS: number = parseInt(GetEnvVar('JSINFO_INDEXER_N_WORKERS', "2"));
export const JSINFO_INDEXER_BATCH_SIZE: number = parseInt(GetEnvVar('JSINFO_INDEXER_BATCH_SIZE', "100"));
export const JSINFO_INDEXER_POLL_MS: number = parseInt(GetEnvVar('JSINFO_INDEXER_POLL_MS', "5000"));
export const JSINFO_INDEXER_START_BLOCK: number = parseInt(GetEnvVar('JSINFO_INDEXER_START_BLOCK', "340778")); // 340778 has a weird date (9 months ago)
export const JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS: number = parseInt(GetEnvVar('JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS', "2"))

export const JSINFO_INDEXER_CACHE_USE_SAVE: number = parseInt(GetEnvVar('JSINFO_INDEXER_SAVE_CACHE', "0"));
export const JSINFO_INDEXER_CACHE_USE_READ: number = parseInt(GetEnvVar('JSINFO_INDEXER_READ_CACHE', "0"));
export const JSINFO_INDEXER_CACHE_PATH: string = GetEnvVar('JSINFO_INDEXER_CACHE_PATH', join(homedir(), 'Documents/jsinfo_disk_cache'));
export const JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION: number = parseInt(GetEnvVar('JSINFO_INDEXER_CACHE_USE_PAKO_COMPRESSION', "1"));
export const JSINFO_INDEXER_CACHE_MAX_SIZE: number = ParseSizeToBytes(GetEnvVar('JSINFO_INDEXER_CACHE_MAX_SIZE', "50gb"));
export const JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH: number = parseInt(GetEnvVar('JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH', "5000"));

// lava_provider_bonus_rewards was 600 keys
export const JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX: number = parseInt(GetEnvVar('JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX', "5000"));

export const JSINFO_INDEXER_RUN_MIGRATIONS: boolean = GetEnvVar('JSINFO_INDEXER_RUN_MIGRATIONS', "false").toLowerCase() == "true";
// Checks

// Create the directory if it doesn't exist
if (!existsSync(JSINFO_INDEXER_CACHE_PATH)) {
    try {
        mkdirSync(JSINFO_INDEXER_CACHE_PATH, { recursive: true });
    } catch (err) {
        console.error(`Failed to create directory at ${JSINFO_INDEXER_CACHE_PATH}`);
        throw err;
    }
}

// Check again if the directory was created
if (!existsSync(JSINFO_INDEXER_CACHE_PATH)) {
    throw new Error(`Failed to create directory at ${JSINFO_INDEXER_CACHE_PATH}`);
}
