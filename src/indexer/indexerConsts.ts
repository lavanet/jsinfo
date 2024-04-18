import { GetEnvVar } from '../utils';

export const JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE: number = parseInt(GetEnvVar('JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE', "20"));
export const JSINFO_INDEXER_LAVA_RPC: string = GetEnvVar("JSINFO_INDEXER_LAVA_RPC", "https://public-rpc.lavanet.xyz/");
export const JSINFO_INDEXER_N_WORKERS: number = parseInt(GetEnvVar('JSINFO_INDEXER_N_WORKERS', "2"));
export const JSINFO_INDEXER_BATCH_SIZE: number = parseInt(GetEnvVar('JSINFO_INDEXER_BATCH_SIZE', "100"));
export const JSINFO_INDEXER_POLL_MS: number = parseInt(GetEnvVar('JSINFO_INDEXER_POLL_MS', "5000"));
export const JSINFO_INDEXER_START_BLOCK: number = parseInt(GetEnvVar('JSINFO_INDEXER_START_BLOCK', "340778")); // 340778 has a weird date (9 months ago)
export const JSINFO_INDEXER_BLOCK_TYPE: string = GetEnvVar('JSINFO_INDEXER_BLOCK_TYPE', "both"); // 340778 has a weird date (9 months ago)
export const JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS: number = parseInt(GetEnvVar('JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS', "2"))

export const JSINFO_INDEXER_IS_SAVE_CACHE: number = parseInt(GetEnvVar('JSINFO_INDEXER_SAVE_CACHE', "0"));
export const JSINFO_INDEXER_IS_READ_CACHE: number = parseInt(GetEnvVar('JSINFO_INDEXER_READ_CACHE', "0"));
export const JSINFO_INDEXER_CACHE_PATH: string = GetEnvVar('JSINFO_INDEXER_CACHE_PATH');

const JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES: string[] = ['even', 'odd', 'both'];

if (!JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES.includes(JSINFO_INDEXER_BLOCK_TYPE)) {
    const message = `Invalid value for JSINFO_INDEXER_BLOCK_TYPE: ${JSINFO_INDEXER_BLOCK_TYPE}. Expected one of ${JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES.join(', ')}.`;
    console.error(message);
    throw new Error(message);
}

export const JSINFO_INDEXER_DEBUG_DUMP_EVENTS: boolean = GetEnvVar('JSINFO_INDEXER_DEBUG_DUMP_EVENTS', "false").toLowerCase() == "true";

export const JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH: number = parseInt(GetEnvVar('JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH', "5000"));
