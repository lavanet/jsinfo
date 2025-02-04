import { RedisFetch } from '../../redis/RedisFetch';
import { logger } from '@jsinfo/utils/logger';
import { CoinGekoCache } from './CoinGeko/CoinGekoCache';
import Decimal from 'decimal.js';

// https://app.osmosis.zone/assets/LAVA
// also called LAVA here, not lava-network
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

interface OsmosisTVLResult {
    ulavaValue: number;
    usdValue: number;
}

// Updated return type and function logic
export async function OsmosisGetTotalLavaLockedValue(): Promise<OsmosisTVLResult | null> {
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
        let totalLockedValue = new Decimal(0);
        pools.forEach(pool => {
            const reserveCoins: ReserveCoin[] = pool.reserveCoins.map(coin => JSON.parse(coin));
            reserveCoins.forEach(coin => {
                if (coin.currency.coinDenom.toLowerCase() === 'lava') {
                    totalLockedValue = totalLockedValue.plus(new Decimal(coin.amount));
                }
            });
        });

        logger.info(`TLV-OSM: Total locked value in LAVA from first API: ${totalLockedValue.toNumber()}`);

        const currentPrice = await CoinGekoCache.GetLavaUSDRate();
        if (currentPrice === 0 || isNaN(currentPrice)) {
            throw new Error('OsmosisGetTotalLavaLockedValue: CoinGekoCache.GetDenomToUSDRate returned 0 for lava');
        }

        if (currentPrice > 100000 || currentPrice < 1.e-7) {
            throw new Error(`OsmosisGetTotalLavaLockedValue: CoinGekoCache.GetDenomToUSDRate returned out of range value for lava: ${currentPrice}`);
        }

        const usdValue = totalLockedValue.toNumber() * Number(currentPrice / 1000000);
        logger.info(`TLV-OSM: Total locked USDC value from API: ${usdValue}`);

        return {
            ulavaValue: totalLockedValue.toNumber(),
            usdValue: usdValue
        };

    } catch (error) {
        logger.error('TLV-OSM: Error fetching total locked value from first API:', error);
        return null;
    }
}

// Check if the script is being run as the main module
if (require.main === module) {
    OsmosisGetTotalLavaLockedValue(); // Call the function only in main
}
