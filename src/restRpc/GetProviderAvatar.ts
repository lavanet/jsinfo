import { RpcPeriodicEndpointCache } from './LavaRpcPeriodicEndpointCache';
import { RedisFetch } from '@jsinfo/redis/RedisFetch';
import { logger } from '@jsinfo/utils/logger';

interface KeybaseResponse {
    status: {
        code: number;
        name: string;
    };
    them: Array<{
        id: string;
        pictures?: {
            primary?: {
                url?: string;
            };
        };
    }>;
}

/**
 * Gets avatar URL for a specific provider
 * @param providerId Lava provider address
 * @returns Avatar URL or null if not found
 */
export async function GetProviderAvatar(providerId: string): Promise<string | null> {
    try {
        const metadata = await RpcPeriodicEndpointCache.GetProviderMetadata();
        const provider = metadata?.MetaData?.find(p => p.provider === providerId);

        if (!provider?.description?.identity) {
            return null;
        }

        const keybaseUrl = `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${provider.description.identity}&fields=pictures`;
        const response = await RedisFetch<KeybaseResponse>(keybaseUrl, 3600);

        return response?.them?.[0]?.pictures?.primary?.url || null;
    } catch (error) {
        logger.error('Error fetching provider avatar:', error);
        return null;
    }
}

/**
 * Gets avatar URLs for all providers
 * @returns Map of provider IDs to avatar URLs
 */
export async function GetAllProviderAvatars(): Promise<Map<string, string>> {
    try {
        const metadata = await RpcPeriodicEndpointCache.GetProviderMetadata();
        const avatarMap = new Map<string, string>();

        if (!metadata?.MetaData) {
            return avatarMap;
        }

        const providers = metadata.MetaData.filter(p => p.description?.identity);

        // Fetch all avatars in parallel
        const avatarPromises = providers.map(async provider => {
            const keybaseUrl = `https://keybase.io/_/api/1.0/user/lookup.json?key_suffix=${provider.description.identity}&fields=pictures`;
            const response = await RedisFetch<KeybaseResponse>(keybaseUrl, 3600);
            const avatarUrl = response?.them?.[0]?.pictures?.primary?.url;

            if (avatarUrl) {
                avatarMap.set(provider.provider, avatarUrl);
            }
        });

        await Promise.all(avatarPromises);
        return avatarMap;
    } catch (error) {
        logger.error('Error fetching all provider avatars:', error);
        return new Map();
    }
}
