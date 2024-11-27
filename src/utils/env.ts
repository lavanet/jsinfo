import { IsMeaningfulText, JSONStringify, MaskPassword } from "./fmt";

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

export function IsIndexerProcess(): boolean {
    return GetEnvVar("IS_INDEXER_PROCESS", "false") === "true";
}

export function GetRedisUrls(): { read: string[]; write: string[] } {
    const envKey = IsIndexerProcess()
        ? "JSINFO_INDEXER_REDDIS_CACHE"
        : "JSINFO_QUERY_REDDIS_CACHE";

    const redisUrls = GetEnvVar(envKey, "-");
    const readUrls = GetEnvVar(envKey + '_READ', "-");
    const redisUrls1 = GetEnvVar(envKey + '_1', "-");
    const readUrls1 = GetEnvVar(envKey + '_READ_1', "-");

    const writeUrls = [...redisUrls.split(','), ...redisUrls1.split(',')]
        .map(url => url.trim())
        .filter(url => IsMeaningfulText(url))
        .sort((a, b) => {
            const aStartsWithNumber = /^\d+_/.test(a);
            const bStartsWithNumber = /^\d+_/.test(b);
            return aStartsWithNumber ? -1 : bStartsWithNumber ? 1 : 0; // Move items starting with numbers to the front
        })
        .map(url => url.replace(/^1_/, '')); // Remove prefix '1_'

    const readUrlsArray = [...readUrls.split(','), ...readUrls1.split(',')]
        .map(url => url.trim())
        .filter(url => IsMeaningfulText(url))
        .sort((a, b) => {
            const aStartsWithNumber = /^\d+_/.test(a);
            const bStartsWithNumber = /^\d+_/.test(b);
            return aStartsWithNumber ? -1 : bStartsWithNumber ? 1 : 0; // Move items starting with numbers to the front
        })
        .map(url => url.replace(/^1_/, '')); // Remove prefix '1_'

    return {
        read: readUrlsArray,
        write: writeUrls
    };
}

// run MaskPassword on each redisurl item
const redisUrls = await GetRedisUrls();
const maskedUrlsWrite = redisUrls.write.map(url => MaskPassword(url));
const maskedUrlsRead = redisUrls.read.map(url => MaskPassword(url));
console.log("Masked RedisUrls::", JSONStringify({ write: maskedUrlsWrite, read: maskedUrlsRead }));
