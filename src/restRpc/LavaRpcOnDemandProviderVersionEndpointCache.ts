// src/restRpc/LavaRpcOnDemandProviderVersionEndpointCache.ts

import { logger } from '@jsinfo/utils/logger';
import { QueryLavaRPC } from '@jsinfo/restRpc/LavaRpc';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { TruncateError } from '@jsinfo/utils/fmt';

export interface ProtocolVersions {
    provider_target: string;
    provider_min: string;
    consumer_target: string;
    consumer_min: string;
}

export interface ProtocolParams {
    params: {
        version: ProtocolVersions;
    };
}

const CACHE_KEYS = {
    PROTOCOL_VERSIONS: 'protocol_versions_cache',
} as const;

class RpcOnDemandProviderVersionEndpointCacheClass {
    private cacheRefreshInterval = 60 * 60; // 1 hour

    /**
     * Gets the protocol version parameters from cache or API
     */
    public async GetProtocolVersions(): Promise<ProtocolVersions> {
        const cacheKey = CACHE_KEYS.PROTOCOL_VERSIONS;
        let versions = await RedisCache.getDict(cacheKey) as ProtocolVersions;

        if (!versions) {
            versions = await this.fetchAndCacheProtocolVersions();
            if (!versions) {
                logger.warn('Protocol versions not found in cache after refresh');
                return {
                    provider_target: '5.3.0',
                    provider_min: '4.2.1',
                    consumer_target: '5.3.0',
                    consumer_min: '4.2.1'
                };
            }
        }

        return versions;
    }

    /**
     * Fetches the protocol parameters from the Lava API and caches them
     */
    private async fetchAndCacheProtocolVersions(): Promise<ProtocolVersions> {
        const cacheKey = CACHE_KEYS.PROTOCOL_VERSIONS;
        try {
            const response = await QueryLavaRPC<ProtocolParams>('/lavanet/lava/protocol/params');
            const versions = response.params.version;

            RedisCache.setDict(cacheKey, versions, this.cacheRefreshInterval);
            logger.info('Fetched and cached protocol versions', { versions });

            return versions;
        } catch (error) {
            logger.error('Error fetching protocol versions', { error: TruncateError(error) });
            throw error;
        }
    }

    /**
     * Gets the minimum provider version from the protocol parameters
     */
    public async GetMinProviderVersion(): Promise<string> {
        const versions = await this.GetProtocolVersions();
        return versions.provider_min;
    }

    /**
     * Gets the target provider version from the protocol parameters
     */
    public async GetTargetProviderVersion(): Promise<string> {
        const versions = await this.GetProtocolVersions();
        return versions.provider_target;
    }

    /**
     * Checks if a version string is higher than the minimum provider version
     * @param versionToCheck The version string to check
     */
    public async IsVersionHigherThanMinProviderVersion(versionToCheck: string): Promise<boolean> {
        const minVersion = await this.GetMinProviderVersion();
        return this.compareVersions(versionToCheck, minVersion) > 0;
    }

    /**
     * Compares two version strings
     * @param version1 First version string
     * @param version2 Second version string
     * @returns 1 if version1 > version2, -1 if version1 < version2, 0 if they are equal
     */
    public compareVersions(version1: string, version2: string): number {
        if (version1 === version2) {
            return 0;
        }

        const parts1 = version1.split('.');
        const parts2 = version2.split('.');

        const maxLength = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLength; i++) {
            // If we've reached the end of one version string, the longer one is greater
            if (i >= parts1.length) return -1;
            if (i >= parts2.length) return 1;

            // Parse the parts as integers
            const num1 = parseInt(parts1[i], 10);
            const num2 = parseInt(parts2[i], 10);

            if (isNaN(num1) || isNaN(num2)) {
                logger.warn('Failed parsing version part to number', {
                    part1: parts1[i],
                    part2: parts2[i]
                });
                // If we can't parse as numbers, do a string comparison
                if (parts1[i] !== parts2[i]) {
                    return parts1[i] > parts2[i] ? 1 : -1;
                }
            } else {
                // Compare the numeric values
                if (num1 !== num2) {
                    return num1 > num2 ? 1 : -1;
                }
            }
        }

        // If we get here, the versions are equal
        return 0;
    }
}

export const RpcOnDemandProviderVersionEndpointCache = new RpcOnDemandProviderVersionEndpointCacheClass();