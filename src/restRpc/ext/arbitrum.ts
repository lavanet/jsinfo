import axios from 'axios';
import { CoinGekoCache } from './CoinGeko/CoinGekoCache';
import { RedisCache } from '@jsinfo/redis/classes/RedisCache';

// https://app.uniswap.org/explore/tokens/arbitrum/0x11e969e9b3f89cb16d686a03cd8508c9fc0361af

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

        // console.log('Response data:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching token data:', error);
    }
}


export async function AribitrumGetTotalLavaValue(): Promise<bigint | null> {
    const cacheKey = 'Arbitrum::TotalLavaValue';
    const cacheTTL = 20 * 60; // Cache for 20 minutes
    const minCacheTTL = 5 * 60; // Refetch if cache is less than 5 minutes
    const maxRetries = 10; // Maximum number of retries

    const fetchPromise = async (): Promise<bigint | null> => {
        let attempts = 0;
        let totalLavaValue: bigint | null = null;

        while (attempts < maxRetries) {
            try {
                // Fetch token data
                const tokenData = (await fetchTokenData()).data.token;
                // console.log("Token data:", tokenData);

                // Extract total value locked in USD
                const totalValueLockedValue = tokenData.market.totalValueLocked.value;

                // Check if totalValueLockedValue is a valid number before converting
                if (totalValueLockedValue && !isNaN(Number(totalValueLockedValue))) {
                    const totalValueLocked = totalValueLockedValue; // Total value locked in USD
                    console.log("Arbitrum Total value locked in USD:", totalValueLocked);

                    // Get the current price of LAVA in USD
                    const currentPriceValue = tokenData.market.price.value;

                    // Check if currentPriceValue is a valid number before converting
                    if (currentPriceValue && !isNaN(Number(currentPriceValue))) {
                        const currentPrice = await CoinGekoCache.GetDenomToUSDRate('lava'); // Current price of LAVA in USD

                        // Calculate total LAVA value
                        totalLavaValue = BigInt(Math.ceil(Number(totalValueLocked) / Number(currentPrice))); // Convert total value locked in USD to LAVA
                        console.log("TLV-ARBITRUM: Total LAVA Value:", totalLavaValue, "lava", currentPrice);
                        // Cache the result in Redis
                        RedisCache.set(cacheKey, totalLavaValue.toString(), cacheTTL);
                        return totalLavaValue; // Return the total LAVA value
                    } else {
                        throw new Error('TLV-ARBITRUM: Invalid current price value');
                    }
                } else {
                    throw new Error('TLV-ARBITRUM: Invalid total value locked');
                }
            } catch (error) {
                console.error('Error fetching token data:', error);
                attempts++;
                if (attempts >= maxRetries) {
                    throw new Error('TLV-ARBITRUM: Max retries reached. Unable to fetch total LAVA value.');
                }
            }
        }
        throw new Error('TLV-ARBITRUM: Failed to fetch total LAVA value after retries.');
    }

    const cachedValue = await RedisCache.get(cacheKey);
    if (cachedValue !== null) {
        const remainingTTL = await RedisCache.getTTL(cacheKey);
        if (remainingTTL && remainingTTL < minCacheTTL) {
            fetchPromise();
        }
        console.log("TLV-ARBITRUM: Using cached value:", cachedValue);
        return BigInt(cachedValue); // Return cached value if available
    }

    return await fetchPromise();
}

// Call the function to execute the request
if (require.main === module) {
    AribitrumGetTotalLavaValue();
}
