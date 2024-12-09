import { IsMeaningfulText, JSONStringify, MaskPassword } from "./fmt";
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


export function ParsePrioritizedEnvVars(
    envVars: string[],
    errorMessage: string,
    logPrefix: string,
    maskValues: boolean = true,
    throwError: boolean = true
): string[] {
    const values = new Map<number, string>();  // priority -> value

    for (const envVar of envVars) {
        try {
            const value = process.env[envVar];
            if (!value || value.trim() === '' || !IsMeaningfulText(value)) continue;

            // Check if value starts with number_
            const match = value.match(/^(\d+)_(.+)/);
            if (match) {
                const priority = parseInt(match[1]);
                if (!Array.from(values.values()).includes(match[2])) {
                    values.set(priority, match[2]);
                }
            } else {
                // Non-numbered values get high priority numbers
                if (!Array.from(values.values()).includes(value)) {
                    values.set(1000 + values.size, value);
                }
            }
        } catch (error) {
            continue;
        }
    }

    if (values.size === 0) {
        if (throwError) {
            logger.error(errorMessage);
            throw new Error(errorMessage);
        } else {
            return [];
        }
    }

    // Sort by priority and get only the values
    const sortedValues = Array.from(values.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, value]) => value);

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
// run MaskPassword on each redisurl item
const redisUrls = await GetRedisUrls();
const maskedUrlsWrite = redisUrls.write.map(url => MaskPassword(url));
const maskedUrlsRead = redisUrls.read.map(url => MaskPassword(url));
console.log("Masked RedisUrls::", JSONStringify({ write: maskedUrlsWrite, read: maskedUrlsRead }));

