import { IsMeaningfulText, MaskPassword } from "./fmt";
import { logger } from "./logger";
import { Sleep } from "./sleep";

export function GetEnvVar(key: string, alt?: string): string {
    const value = process.env[key];
    if (!value) {
        if (alt !== undefined) {
            return alt;
        }
        throw new Error(`${key} environment variable is not set or is an empty string`);
    }
    return value;
}

// Cache for parsed environment variables
const ParsePrioritizedEnvVars_Cache = new Map<string, string[]>();

export function ParsePrioritizedEnvVars(
    envVars: string[],
    errorMessage: string,
    logPrefix: string,
    maskValues: boolean = true,
    throwError: boolean = true
): string[] {
    // Create a cache key from the input parameters
    const cacheKey = `${envVars.join('|')}|${errorMessage}|${logPrefix}|${maskValues}|${throwError}`;

    // Check cache first
    const cachedResult = ParsePrioritizedEnvVars_Cache.get(cacheKey);
    if (cachedResult) {
        return cachedResult;
    }

    const valuesByPriority = new Map<number, string[]>();  // priority -> values[]

    for (const envVar of envVars) {
        try {
            const value = process.env[envVar];
            if (!value || value.trim() === '' || !IsMeaningfulText(value)) continue;

            const multipleValues = value.split(',').map(v => v.trim());

            for (const singleValue of multipleValues) {
                if (!IsMeaningfulText(singleValue)) continue;

                // Check if value starts with number_
                const match = singleValue.match(/^(\d+)_(.+)/);
                if (match) {
                    const priority = parseInt(match[1]);
                    const currentValues = valuesByPriority.get(priority) || [];
                    if (!IsMeaningfulText(match[2])) {
                        throw new Error(`Invalid value for ${envVar}: ${singleValue}`);
                    }
                    currentValues.push(match[2]);
                    valuesByPriority.set(priority, currentValues);
                } else {
                    // Non-numbered values get high priority numbers
                    const priority = 1000;
                    const currentValues = valuesByPriority.get(priority) || [];
                    currentValues.push(singleValue);
                    valuesByPriority.set(priority, currentValues);
                }
            }
        } catch (error) {
            continue;
        }
    }

    if (valuesByPriority.size === 0) {
        if (throwError) {
            logger.error(errorMessage);
            throw new Error(errorMessage);
        } else {
            return [];
        }
    }

    // Sort by priority and flatten all values
    const sortedValues = Array.from(new Set(
        Array.from(valuesByPriority.entries())
            .sort((a, b) => a[0] - b[0])
            .flatMap(([_, values]) => values)
    ));

    // Cache the result
    ParsePrioritizedEnvVars_Cache.set(cacheKey, sortedValues);

    // Log the results
    const displayValues = maskValues
        ? sortedValues.map(value => MaskPassword(value))
        : sortedValues;

    logger.info(`${logPrefix} values loaded:`, displayValues.join(', '));

    return sortedValues;
}

export function IsIndexerProcess(): boolean {
    return GetEnvVar("IS_INDEXER_PROCESS", "false") === "true";
}

export function IsMainnet(): boolean {
    return GetEnvVar("JSINFO_NETWORK", "").toLowerCase().includes("mainnet");
}

export function IsTestnet(): boolean {
    return GetEnvVar("JSINFO_NETWORK", "").toLowerCase().includes("testnet");
}

export function GetRedisUrls(): { read: string[]; write: string[] } {
    const envKey = IsIndexerProcess()
        ? "JSINFO_INDEXER_REDDIS_CACHE"
        : "JSINFO_QUERY_REDDIS_CACHE";

    const writeUrls = ParsePrioritizedEnvVars(
        [
            `${envKey}_1`,
            envKey,
        ],
        "Missing Redis write URLs",
        "redis write",
        true,
        true
    );

    if (writeUrls.length === 0) {
        logger.error("Missing Redis write, sleeping for 60 seconds and exiting");
        Sleep(60000);
        process.exit(1);
    }

    // Get read URLs
    const readUrls = ParsePrioritizedEnvVars(
        [
            `${envKey}_READ_1`,
            `${envKey}_READ`,
        ],
        "Missing Redis read URLs",
        "redis read",
        true,
        false
    );

    return {
        read: readUrls,
        write: writeUrls
    };
}


