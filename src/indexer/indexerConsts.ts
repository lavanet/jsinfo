import { GetEnvVar } from '../utils';

export const JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE = parseInt(GetEnvVar('JSINFO_INDEXER_DO_IN_CHUNKS_CHUNK_SIZE', "20"));
export const JSINFO_INDEXER_LAVA_RPC = GetEnvVar("JSINFO_INDEXER_LAVA_RPC", "https://public-rpc.lavanet.xyz/");
export const JSINFO_INDEXER_N_WORKERS = parseInt(GetEnvVar('JSINFO_INDEXER_N_WORKERS', "2"));
export const JSINFO_INDEXER_BATCH_SIZE = parseInt(GetEnvVar('JSINFO_INDEXER_BATCH_SIZE', "100"));
export const JSINFO_INDEXER_POLL_MS = parseInt(GetEnvVar('JSINFO_INDEXER_POLL_MS', "5000"));
export const JSINFO_INDEXER_START_BLOCK = parseInt(GetEnvVar('JSINFO_INDEXER_START_BLOCK', "340778")); // 340778 has a weird date (9 months ago)
export const JSINFO_INDEXER_BLOCK_TYPE = GetEnvVar('JSINFO_INDEXER_BLOCK_TYPE', "both"); // 340778 has a weird date (9 months ago)
export const JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS = parseInt(GetEnvVar('JSINFO_INDEXER_GRACEFULL_EXIT_AFTER_X_HOURS', "2"))

const JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES = ['even', 'odd', 'both'];

if (!JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES.includes(JSINFO_INDEXER_BLOCK_TYPE)) {
    const message = `Invalid value for JSINFO_INDEXER_BLOCK_TYPE: ${JSINFO_INDEXER_BLOCK_TYPE}. Expected one of ${JSINFO_INDEXER_BLOCK_TYPE_VALID_VALUES.join(', ')}.`;
    console.error(message);
    throw new Error(message);
}