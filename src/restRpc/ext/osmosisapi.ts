import { RedisFetch } from '../../redis/RedisFetch';
import { logger } from '@jsinfo/utils/logger';

// Define TypeScript interfaces for the response structure
interface ReserveCoin {
    currency: {
        coinDenom: string;
        coinName: string;
        coinMinimalDenom: string;
        coinDecimals: number;
        coinGeckoId: string;
        coinImageUrl: string;
        isUnstable: boolean;
        areTransfersDisabled: boolean;
        isVerified: boolean;
        variantGroupKey: string;
        isAlloyed: boolean;
    };
    options: {
        separator: string;
        upperCase: boolean;
        lowerCase: boolean;
        hideDenom: boolean;
        maxDecimals: number;
        trim: boolean;
        shrink: boolean;
        ready: boolean;
        locale: boolean;
        inequalitySymbol: boolean;
        inequalitySymbolSeparator: string;
    };
    amount: string;
}

interface Pool {
    id: string;
    type: string;
    raw: {
        address: string;
        incentives_address: string;
        spread_rewards_address: string;
        current_tick_liquidity: string;
        token0: string;
        token1: string;
        current_sqrt_price: string;
        current_tick: string;
        tick_spacing: string;
        exponent_at_price_one: string;
        spread_factor: string;
        last_liquidity_update: string;
    };
    reserveCoins: string[];
    totalFiatValueLocked: string;
    market: {
        volume24hUsd: string;
        volume7dUsd: string;
        feesSpent24hUsd: string;
        feesSpent7dUsd: string;
    };
}

// Function to get the total locked value in LAVA from the first API
export async function OsmosisGetTotalLavaLockedValue(): Promise<bigint | null> {
    const input = {
        json: {
            limit: 10,
            search: null,
            denoms: ['LAVA'],
            types: [
                'weighted',
                'stable',
                'concentrated',
                'cosmwasm-transmuter',
                'cosmwasm',
                'cosmwasm-astroport-pcl',
                'cosmwasm-whitewhale'
            ],
            incentiveTypes: ['superfluid', 'osmosis', 'boost', 'none'],
            sort: {
                keyPath: 'market.volume24hUsd',
                direction: 'desc'
            },
            minLiquidityUsd: 1000,
            cursor: 0
        },
        meta: {
            values: {
                search: ['undefined']
            }
        }
    };

    const apiUrl = `https://app.osmosis.zone/api/edge-trpc-pools/pools.getPools?input=${encodeURIComponent(JSON.stringify(input))}`;

    try {
        const response = await RedisFetch(apiUrl);
        const pools: Pool[] = (response as any).result.data.json.items;
        let totalLockedValue = 0;
        pools.forEach(pool => {
            const reserveCoins: ReserveCoin[] = pool.reserveCoins.map(coin => JSON.parse(coin));
            reserveCoins.forEach(coin => {
                if (coin.currency.coinDenom.toLowerCase() === 'lava') {
                    totalLockedValue += parseFloat(coin.amount);
                }
            });
        });

        logger.info(`TLV-OSM: Total locked value in LAVA from first API: ${totalLockedValue}`); // Log the total locked value

        return BigInt(Math.ceil(totalLockedValue));
    } catch (error) {
        logger.error('TLV-OSM: Error fetching total locked value from first API:', error);
        return null;
    }
    return null;
}

// Check if the script is being run as the main module
if (require.main === module) {
    OsmosisGetTotalLavaLockedValue(); // Call the function only in main
}