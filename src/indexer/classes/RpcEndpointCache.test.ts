import { expect, describe, it, beforeAll } from "bun:test";
import { RpcEndpointCache } from './RpcEndpointCache';
import { MemoryCache } from './MemoryCache';
import { QueryLavaRPC } from '../rpcUtils';

describe('RpcEndpointCache', () => {
    beforeAll(() => {
        Bun.env.BUN_TEST_TIMEOUT = "30000"; // 30 seconds
    });

    describe('GetTotalDelegatedAmount', () => {
        it('should return a reasonable BigInt value', async () => {
            const result = await RpcEndpointCache.GetTotalDelegatedAmount();
            expect(typeof result).toBe('bigint');
            expect(result).toBeGreaterThan(BigInt(0));
            expect(result).toBeLessThan(BigInt(1e18)); // Adjust this upper limit as needed
        });

        it('should include empty provider delegations when specified', async () => {
            const resultWithEmpty = await RpcEndpointCache.GetTotalDelegatedAmount(undefined, true);
            const resultWithoutEmpty = await RpcEndpointCache.GetTotalDelegatedAmount(undefined, false);

            expect(resultWithEmpty).toBeGreaterThanOrEqual(resultWithoutEmpty);
            // expect(resultWithEmpty).not.toBe(resultWithoutEmpty); // They should be different

            console.log("\nResults:");
            console.log(`With empty providers:    ${resultWithEmpty.toString()}`);
            console.log(`Without empty providers: ${resultWithoutEmpty.toString()}`);
        });

        it('should filter delegations based on timestamp', async () => {
            const now = Math.floor(Date.now() / 1000);
            const resultNow = await RpcEndpointCache.GetTotalDelegatedAmount(now);
            const resultPast = await RpcEndpointCache.GetTotalDelegatedAmount(now - 30 * 24 * 60 * 60); // 30 days ago
            expect(resultNow).toBeLessThanOrEqual(resultPast);
            expect(resultNow).not.toBe(resultPast); // They should be different
        });
    });

    describe('GetUniqueDelegators', () => {
        it('should return a non-empty array of strings', async () => {
            const result = await RpcEndpointCache.GetUniqueDelegators();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe('string');
        });
    });

    describe('GetProviders', () => {
        it('should return a non-empty array of strings', async () => {
            const result = await RpcEndpointCache.GetProviders();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(typeof result[0]).toBe('string');
        });
    });

    describe('GetProviderDelegators', () => {
        it('should return delegations for a valid provider', async () => {
            const providers = await RpcEndpointCache.GetProviders();
            expect(providers.length).toBeGreaterThan(0);
            const result = await RpcEndpointCache.GetProviderDelegators(providers[0]);
            expect(result).toHaveProperty('delegations');
            expect(Array.isArray(result.delegations)).toBe(true);
            expect(result.delegations.length).toBeGreaterThan(0);
        });
    });

    describe('GetProviderMetadata', () => {
        it('should return metadata for providers', async () => {
            const result = await RpcEndpointCache.GetProviderMetadata();
            expect(result).toHaveProperty('MetaData');
            expect(Array.isArray(result.MetaData)).toBe(true);
            expect(result.MetaData.length).toBeGreaterThan(0);
        });
    });

    describe('Data Consistency', () => {
        it('should have consistent data between API and MemoryCache', async () => {
            const providers = await MemoryCache.getArray('providers') || [];
            console.log(`Retrieved ${providers.length} providers from MemoryCache`);

            let inconsistencies = 0;

            for (const provider of providers) {
                try {
                    // Fetch from API
                    const apiResponse = await QueryLavaRPC(`lavanet/lava/dualstaking/provider_delegators/${provider}`);

                    // Fetch from MemoryCache
                    const cacheData = await MemoryCache.get(`provider_delegators_${provider}`);

                    // Compare data
                    if (!isDataConsistent(apiResponse, cacheData)) {
                        console.error(`Inconsistency found for provider ${provider}:`);
                        console.error('API data:', JSON.stringify(apiResponse, null, 2));
                        console.error('Cache data:', JSON.stringify(cacheData, null, 2));
                        inconsistencies++;
                    }
                } catch (error) {
                    console.error(`Error processing provider ${provider}:`, error);
                    inconsistencies++;
                }
            }

            console.log(`Found ${inconsistencies} inconsistencies out of ${providers.length} providers`);
            expect(inconsistencies).toBe(0);
        });
    });
});

function isDataConsistent(apiData, cacheData) {
    if (!apiData || !cacheData) return false;
    if (!apiData.delegations || !cacheData.delegations) return false;
    if (apiData.delegations.length !== cacheData.delegations.length) return false;

    for (let i = 0; i < apiData.delegations.length; i++) {
        const apiDelegation = apiData.delegations[i];
        const cacheDelegation = cacheData.delegations[i];

        if (apiDelegation.provider !== cacheDelegation.provider) return false;
        if (apiDelegation.delegator !== cacheDelegation.delegator) return false;
        if (apiDelegation.amount.denom !== cacheDelegation.amount.denom) return false;
        if (apiDelegation.amount.amount !== cacheDelegation.amount.amount) return false;
        if (apiDelegation.timestamp !== cacheDelegation.timestamp) return false;
    }

    return true;
}
