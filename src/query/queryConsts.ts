// src/query/consts.ts

import { GetEnvVar } from '../utils/utils';

export const JSINFO_QUERY_IS_DEBUG_MODE: boolean = GetEnvVar("JSINFO_QUERY_IS_DEBUG_MODE", "false").toLowerCase() === "true";
export const JSINFO_QUERY_CACHE_POPULTAE_MODE: boolean = GetEnvVar("JSINFO_QUERY_CACHE_POPULTAE_MODE", "false").toLowerCase() === "true";
export const JSINFO_QUERY_FASITY_PRINT_LOGS: boolean = GetEnvVar("JSINFO_QUERY_FASITY_PRINT_LOGS", "false").toLowerCase() === "true";

const JSINFO_QUERY_PORT_STRING = process.env['JSINFO_QUERY_PORT']!;
if (!JSINFO_QUERY_PORT_STRING) {
    throw new Error('JSINFO_QUERY_PORT environment variable is not set or is an empty string');
}

export const JSINFO_QUERY_PORT = parseInt(JSINFO_QUERY_PORT_STRING);
export const JSINFO_QUERY_HOST = GetEnvVar('JSINFO_QUERY_HOST', '0.0.0.0');

export const JSINFO_QUERY_HIGH_POST_BODY_LIMIT = false;

// how many days back to store in the table
export const JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS = parseInt(GetEnvVar("JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS", "30"));
// export const JSINFO_QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CUTOFF_DAYS = parseInt(GetEnvVar("JSINFO_QUERY_PROVIDER_DUAL_STACKING_DELEGATOR_REWARDS_CUTOFF_DAYS", "30"));

// how many items to show per page in the sorted table
export const JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE = parseInt(GetEnvVar("JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE", "20"));
export const JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE = parseInt(GetEnvVar("JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE", "100"));
export const JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION = parseInt(GetEnvVar("JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION", "5000"));

export const JSINFO_QUERY_NETWORK = GetEnvVar("JSINFO_QUERY_NETWORK", "local");

export const JSINFO_NO_READ_DB = GetEnvVar("JSINFO_NO_READ_DB", "true").toLowerCase() === "true";

export const JSINFO_REQUEST_HANDLER_BASE_DEBUG = GetEnvVar("JSINFO_REQUEST_HANDLER_BASE_DEBUG", "true").toLowerCase() === "true";

const numberQueryConsts = [
    'JSINFO_QUERY_PORT',
    'JSINFO_QUERY_PROVIDER_HEALTH_HOURLY_CUTOFF_DAYS',
    'JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE',
    'JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE',
    'JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION',
];

numberQueryConsts.forEach(key => {
    if (Number.isNaN(global[key])) {
        throw new Error(`${key} is NaN`);
    }
});

export const JSINFO_QUERY_MEMORY_DEBUG_MODE = GetEnvVar("JSINFO_QUERY_MEMORY_DEBUG_MODE", "false") == "true";
export const JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE = GetEnvVar("JSINFO_QUERY_CLASS_MEMORY_DEBUG_MODE", "false") == "true";



