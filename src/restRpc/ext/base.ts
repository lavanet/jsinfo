import { logger } from '@jsinfo/utils/logger';
import { RedisFetch } from '../../redis/RedisFetch';
interface PriceChangePercentage {
    m5: string;
    h1: string;
    h6: string;
    h24: string;
}

interface Transactions {
    m5: { buys: number; sells: number; buyers: number; sellers: number; };
    m15: { buys: number; sells: number; buyers: number; sellers: number; };
    m30: { buys: number; sells: number; buyers: number; sellers: number; };
    h1: { buys: number; sells: number; buyers: number; sellers: number; };
    h24: { buys: number; sells: number; buyers: number; sellers: number; };
}

interface VolumeUSD {
    m5: string;
    h1: string;
    h6: string;
    h24: string;
}

interface Attributes {
    base_token_price_usd: string;
    base_token_price_native_currency: string;
    quote_token_price_usd: string;
    quote_token_price_native_currency: string;
    base_token_price_quote_token: string;
    quote_token_price_base_token: string;
    address: string;
    name: string;
    pool_created_at: string;
    fdv_usd: string;
    market_cap_usd: string | null;
    price_change_percentage: PriceChangePercentage;
    transactions: Transactions;
    volume_usd: VolumeUSD;
    reserve_in_usd: string;
}

interface TokenRelationship {
    data: {
        id: string;
        type: string;
    };
}

interface Relationships {
    base_token: TokenRelationship;
    quote_token: TokenRelationship;
    dex: TokenRelationship;
}

interface Pool {
    id: string;
    type: string;
    attributes: Attributes;
    relationships: Relationships;
}

interface ApiResponse {
    data: Pool[];
}

// Function to fetch pool data based on a query
const fetchPools = async (query: string): Promise<Pool[] | null> => {
    const url = `https://api.geckoterminal.com/api/v2/search/pools?query=${query}`;

    try {
        const response = await RedisFetch<ApiResponse>(url);
        return response.data; // Return the array of pools
    } catch (error: any) {
        console.error('TLV-BASE: Error fetching pool data:', error.response ? error.response.data : error.message);
        return null; // Return null in case of error
    }
};

// Function to extract total locked value for the specified pool
const getTotalLockedValue = (pools: Pool[]) => {
    const basePool = pools.find(pool => pool.id.startsWith('base_'));
    if (basePool) {
        const totalLockedValue = basePool.attributes.reserve_in_usd;
        logger.info(`TLV-BASE: Total Locked Value for ${basePool.attributes.name}: $${totalLockedValue}`);
        return totalLockedValue;
    } else {
        logger.info('TLV-BASE: No base pool found.');
        return null;
    }
};

export const BaseGetTotalLockedValue = async (): Promise<number | null> => {
    let totalLockedLava: string | null = null;
    await fetchPools("lava").then(pools => {
        if (totalLockedLava !== null) {
            return;
        }
        if (pools) {
            totalLockedLava = getTotalLockedValue(pools);
        }
    });
    if (totalLockedLava === null) {
        return null;
    }
    logger.info(`TLV-BASE: Total LAVA Value in USD: ${totalLockedLava}`);
    return totalLockedLava;
}
// Execute the function if this file is run directly
if (require.main === module) {
    BaseGetTotalLockedValue().then(totalLockedLava => {
        logger.info(`TLV-BASE: Total Locked Value In Lava: $${totalLockedLava}`);
    });
}