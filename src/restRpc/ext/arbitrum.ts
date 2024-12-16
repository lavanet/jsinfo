import axios from 'axios';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { logger } from '@jsinfo/utils/logger';

// Axelar Wrapped LAVA:
// https://app.uniswap.org/explore/tokens/arbitrum/0x11e969e9b3f89cb16d686a03cd8508c9fc0361af
// it's not called lava-network here , it's called LAVA

async function fetchTokenData() {
    const url = 'https://interface.gateway.uniswap.org/v1/graphql';

    // Define the request body
    const requestBody = {
        operationName: "TokenWeb",
        variables: {
            address: "0x11e969e9b3f89cb16d686a03cd8508c9fc0361af",
            chain: "ARBITRUM"
        },
        query: `query TokenWeb($chain: Chain!, $address: String = null) {
            token(chain: $chain, address: $address) {
                id
                decimals
                name
                chain
                address
                symbol
                standard
                market(currency: USD) {
                    id
                    totalValueLocked {
                        id
                        value
                        currency
                        __typename
                    }
                    price {
                        id
                        value
                        currency
                        __typename
                    }
                    __typename
                }
                project {
                    id
                    name
                    description
                    homepageUrl
                    twitterName
                    logoUrl
                    tokens {
                        id
                        chain
                        address
                        __typename
                    }
                    __typename
                }
                __typename
            }
        }`
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'Accept': '*/*',
                'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'Content-Type': 'application/json',
                'Origin': 'https://app.uniswap.org',
                'Priority': 'u=1, i',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
            }
        });

        return response.data;
    } catch (error) {
        logger.error('Error fetching token data:', error);
    }
}

let currentFetchPromise: Promise<number | null> | null = null;

export async function AribitrumGetTotalLavaValue(): Promise<number | null> {
    const cacheKey = 'Arbitrum::TotalLavaValue';
    const cacheTTL = 20 * 60; // Cache for 20 minutes
    const minCacheTTL = 5 * 60; // Refetch if cache is less than 5 minutes
    const maxRetries = 10; // Maximum number of retries

    const fetchPromise = async (): Promise<number | null> => {
        try {
            let attempts = 0;

            while (attempts < maxRetries) {
                try {
                    const tokenData = (await fetchTokenData()).data.token;
                    const totalValueLockedValue = tokenData.market.totalValueLocked.value;
                    logger.info("TLV-ARBITRUM: Total value locked in USD:", totalValueLockedValue);
                    await RedisCache.set(cacheKey, totalValueLockedValue, cacheTTL);
                    return totalValueLockedValue;
                } catch (error) {
                    logger.error('Error fetching token data:', error);
                    attempts++;
                    if (attempts >= maxRetries) {
                        throw new Error('TLV-ARBITRUM: Max retries reached. Unable to fetch total LAVA value.');
                    }
                }
            }
            throw new Error('TLV-ARBITRUM: Failed to fetch total LAVA value after retries.');
        } finally {
            currentFetchPromise = null;
        }
    }

    const cachedValue = await RedisCache.get(cacheKey);
    if (cachedValue !== null) {
        const remainingTTL = await RedisCache.getTTL(cacheKey);
        if (remainingTTL && remainingTTL < minCacheTTL) {
            if (!currentFetchPromise) {
                currentFetchPromise = fetchPromise();
            }
        }
        logger.info("TLV-ARBITRUM: Using cached value:", cachedValue);
        return Number(cachedValue);
    }

    if (!currentFetchPromise) {
        currentFetchPromise = fetchPromise();
    }

    return currentFetchPromise;
}

// Call the function to execute the request
if (require.main === module) {
    AribitrumGetTotalLavaValue();
}
