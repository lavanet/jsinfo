// src/indexer/restrpc_agregators/CurrencyConverstionUtils.ts

import { RedisCache } from '@jsinfo/redis/classes/RedisCache';
import { CoinGekoCache } from '@jsinfo/restRpc/ext/CoinGeko/CoinGekoCache';
import { RpcOnDemandEndpointCache } from '@jsinfo/restRpc/lavaRpcOnDemandEndpointCache';
import { logger } from '@jsinfo/utils/logger';
import { IsTestnet } from '@jsinfo/utils/env';

const DEMON_LOWEST_LIMIT_WARNING = 1.e-20;
const DEMON_HIGHEST_LIMIT_ERROR = IsTestnet() ? 10_000_000_000_000 : 100_000_000; // 100_000 was ok for mainnet as well

const CACHE_DURATION = {
    DENOM_TRACE: 3600 * 24, // 1 day
};

const DENOM_CONVERSIONS = {
    "ulava": { baseDenom: "lava", factor: 1_000_000 },                    // Lava (LAVA)
    "uatom": { baseDenom: "atom", factor: 1_000_000 },                    // Cosmos (ATOM)
    "uosmo": { baseDenom: "osmo", factor: 1_000_000 },                    // Osmosis (OSMO)
    "ujuno": { baseDenom: "juno", factor: 1_000_000 },                    // Juno (JUNO)
    "ustars": { baseDenom: "stars", factor: 1_000_000 },                    // Stargaze (STARS)
    "uakt": { baseDenom: "akt", factor: 1_000_000 },                    // Akash (AKT)
    "uhuahua": { baseDenom: "huahua", factor: 1_000_000 },                    // Chihuahua (HUAHUA)
    "uevmos": { baseDenom: "evmos", factor: 1_000_000_000_000_000_000 },    // Evmos (EVMOS)
    "inj": { baseDenom: "inj", factor: 1_000_000_000_000_000_000 },    // Injective (INJ)
    "aevmos": { baseDenom: "evmos", factor: 1_000_000_000_000_000_000 },    // Evmos (EVMOS)
    "basecro": { baseDenom: "cro", factor: 100_000_000 },                  // Crypto.com (CRO)
    "uscrt": { baseDenom: "scrt", factor: 1_000_000 },                    // Secret (SCRT)
    "uiris": { baseDenom: "iris", factor: 1_000_000 },                    // IRISnet (IRIS)
    "uregen": { baseDenom: "regen", factor: 1_000_000 },                    // Regen (REGEN)
    "uion": { baseDenom: "ion", factor: 1_000_000 },                    // Ion (ION)
    "nanolike": { baseDenom: "like", factor: 1_000_000_000 },                // LikeCoin (LIKE)
    "uaxl": { baseDenom: "axl", factor: 1_000_000 },                    // Axelar (AXL)
    "uband": { baseDenom: "band", factor: 1_000_000 },                    // Band Protocol (BAND)
    "ubld": { baseDenom: "bld", factor: 1_000_000 },                    // Agoric (BLD)
    "ucmdx": { baseDenom: "cmdx", factor: 1_000_000 },                    // COMDEX (CMDX)
    "ucre": { baseDenom: "cre", factor: 1_000_000 },                    // Crescent (CRE)
    "uxprt": { baseDenom: "xprt", factor: 1_000_000 },                    // Persistence (XPRT)
    "uusdc": { baseDenom: "usdc", factor: 1_000_000 },                    // USD Coin (USDC)
};

export async function ConvertToBaseDenom(amount: string, denom: string): Promise<[string, string]> {
    let baseAmount = parseFloat(amount);
    let baseDenom = denom;

    if (baseDenom.startsWith("ibc/")) {

        const cachedValue = await RedisCache.getDict(`denom-${denom}`);
        if (cachedValue) {
            baseDenom = cachedValue.baseDenom;
        }

        else {
            const denomWithoutPrefix = denom.slice(4);
            const denomTrace = await RpcOnDemandEndpointCache.GetDenomTrace(denomWithoutPrefix);
            baseDenom = denomTrace.denom_trace.base_denom;
            await RedisCache.setDict(`denom-${denom}`, { baseDenom }, CACHE_DURATION.DENOM_TRACE); // cache for 1 day
        }
    }

    const originalBaseDenom = baseDenom;

    if (baseDenom in DENOM_CONVERSIONS) {
        const { baseDenom: newBaseDenom, factor } = DENOM_CONVERSIONS[baseDenom];
        baseDenom = newBaseDenom;
        baseAmount = baseAmount / factor;
    }

    if (baseAmount < DEMON_LOWEST_LIMIT_WARNING) {
        logger.warn(`ConvertToBaseDenom out of range (2small) values: amount = ${amount}, denom = ${denom}, baseAmount = ${baseAmount}, baseDenom = ${baseDenom}, originalBaseDenom = ${originalBaseDenom}`);
        return [baseAmount.toString(), baseDenom];
    }

    if (baseAmount > DEMON_HIGHEST_LIMIT_ERROR) {
        logger.error(`ConvertToBaseDenom out of range (2big) values: amount = ${amount}, denom = ${denom}, baseAmount = ${baseAmount}, baseDenom = ${baseDenom}, originalBaseDenom = ${originalBaseDenom}`);
        return ["0".toString(), baseDenom];
    }

    return [baseAmount.toString(), baseDenom];
}

export async function GetUSDCValue(amount: string, denom: string): Promise<string> {
    const usdcRate = await CoinGekoCache.GetDenomToUSDRate(denom);
    if (usdcRate === 0) {
        logger.warn(`GetUSDCValue CoinGekoCache.GetDenomToUSDRate returned 0 for denom = ${denom}`);
        return "0";
    }

    const result = (parseFloat(amount) * usdcRate);

    if (result < DEMON_LOWEST_LIMIT_WARNING) {
        logger.warn(`GetUSDCValue out of range (2small) values: amount = ${amount}, denom = ${denom}, usdcRate = ${usdcRate}, result = ${result}`);
        return result.toString();
    }

    if (result > DEMON_HIGHEST_LIMIT_ERROR) {
        logger.error(`GetUSDCValue out of range (2big) values: amount = ${amount}, denom = ${denom}, usdcRate = ${usdcRate}, result = ${result}`);
        return "0".toString();
    }

    return result.toString();
}