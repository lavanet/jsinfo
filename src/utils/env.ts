import { IsMeaningfulText } from "./fmt";

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

    const redisUrls = GetEnvVar(envKey);
    const readUrls = GetEnvVar(envKey + '_READ');

    const writeUrls = redisUrls.split(',')
        .map(url => url.trim())
        .filter(url => IsMeaningfulText(url));

    const readUrlsArray = readUrls.split(',')
        .map(url => url.trim())
        .filter(url => IsMeaningfulText(url));

    return {
        read: readUrlsArray,
        write: writeUrls
    };
}
