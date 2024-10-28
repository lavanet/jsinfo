import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { MemoryCache } from "../../classes/MemoryCache";
import { calculatePercentile, fetchData, QueryLavaRPC } from "../utils";
import { logger } from '../../../utils/utils';
import denomsData from './denoms.json';
import { JSINFO_QUERY_NETWORK } from '../../../query/queryConsts';


// Constants
const BENCHMARK_AMOUNT = 10_000_000_000;
const BENCHMARK_DENOM = "ulava";
const PERCENTILE = 0.8;
const CACHE_DURATION = {
  COINGECKO_RATE: 300,    // 5 minutes
  DENOM_TRACE: 3600 * 24, // 1 day
};
const TEST_DENOMS = ["ibc/E3FCBEDDBAC500B1BAB90395C7D1E4F33D9B9ECFE82A16ED7D7D141A0152323F"]
const DENOM_CONVERSIONS = {
    "ulava":    { baseDenom: "lava",  factor: 1_000_000 },                    // Lava (LAVA)
    "uatom":    { baseDenom: "atom",  factor: 1_000_000 },                    // Cosmos (ATOM)
    "uosmo":    { baseDenom: "osmo",  factor: 1_000_000 },                    // Osmosis (OSMO)
    "ujuno":    { baseDenom: "juno",  factor: 1_000_000 },                    // Juno (JUNO)
    "ustars":   { baseDenom: "stars", factor: 1_000_000 },                    // Stargaze (STARS)
    "uakt":     { baseDenom: "akt",   factor: 1_000_000 },                    // Akash (AKT)
    "uhuahua":  { baseDenom: "huahua",factor: 1_000_000 },                    // Chihuahua (HUAHUA)
    "uevmos":   { baseDenom: "evmos", factor: 1_000_000_000_000_000_000 },    // Evmos (EVMOS)
    "inj":      { baseDenom: "inj",   factor: 1_000_000_000_000_000_000 },    // Injective (INJ)
    "aevmos":   { baseDenom: "evmos", factor: 1_000_000_000_000_000_000 },    // Evmos (EVMOS)
    "basecro":  { baseDenom: "cro",   factor: 100_000_000 },                  // Crypto.com (CRO)
    "uscrt":    { baseDenom: "scrt",  factor: 1_000_000 },                    // Secret (SCRT)
    "uiris":    { baseDenom: "iris",  factor: 1_000_000 },                    // IRISnet (IRIS)
    "uregen":   { baseDenom: "regen", factor: 1_000_000 },                    // Regen (REGEN)
    "uion":     { baseDenom: "ion",   factor: 1_000_000 },                    // Ion (ION)
    "nanolike": { baseDenom: "like",  factor: 1_000_000_000 },                // LikeCoin (LIKE)
    "uaxl":     { baseDenom: "axl",   factor: 1_000_000 },                    // Axelar (AXL)
    "uband":    { baseDenom: "band",  factor: 1_000_000 },                    // Band Protocol (BAND)
    "ubld":     { baseDenom: "bld",   factor: 1_000_000 },                    // Agoric (BLD)
    "ucmdx":    { baseDenom: "cmdx",  factor: 1_000_000 },                    // COMDEX (CMDX)
    "ucre":     { baseDenom: "cre",   factor: 1_000_000 },                    // Crescent (CRE)
    "uxprt":    { baseDenom: "xprt",  factor: 1_000_000 },                    // Persistence (XPRT)
};

interface AllChainsResponse {
    chainInfoList: {
      chainName: string;
      chainID: string;
      enabledApiInterfaces: string[];
      api_count: string;
    }[];
  }
  
  interface ProviderPerSpecResponse {
    stakeEntry: {
      stake: {
        denom: string;
        amount: string;
      };
      address: string;
      stake_applied_block: string;
      endpoints: {
        iPPORT: string;
        geolocation: number;
        addons: string[];
        api_interfaces: string[];
        extensions: string[];
      }[];
      geolocation: number;
      chain: string;
      moniker: string;
      delegate_total: {
        denom: string;
        amount: string;
      };
      delegate_limit: {
        denom: string;
        amount: string;
      };
      delegate_commission: string;
      last_change: string;
      block_report: {
        epoch: string;
        latest_block: string;
      };
      vault: string;
      description: {
        moniker: string;
        identity: string;
        website: string;
        security_contact: string;
        details: string;
      };
      jails: string;
      jail_end_time: string;
    }[];
  }
  

  interface AllValidatorsResponse {
    validators: {
      operator_address: string;
      consensus_pubkey: {
        "@type": string;
        [key: string]: string;
      };
      jailed: boolean;
      status: string;
      tokens: string;
      delegator_shares: string;
      description: {
        moniker: string;
        identity: string;
        website: string;
        security_contact: string;
        details: string;
      };
      unbonding_height: string;
      unbonding_time: string;
      commission: {
        commission_rates: {
          rate: string;
          max_rate: string;
          max_change_rate: string;
        };
        update_time: string;
      };
      min_self_delegation: string;
      unbonding_on_hold_ref_count: string;
      unbonding_ids: string[];
    }[];
    pagination: {
      next_key: string;
      total: string;
    };
  }

  interface EstimatedRewardsResponse {
    info: {
      source: string;
      amount: {
        denom: string;
        amount: string;
      };
    }[];
    total: {
      denom: string;
      amount: string;
    }[];
  }
  
  interface DenomTraceResponse {
    denom_trace: {
        path: string;
        base_denom: string;
    }
  }

async function GetAllChains(): Promise<AllChainsResponse> {
    return QueryLavaRPC<AllChainsResponse>(`/lavanet/lava/spec/show_all_chains`);
}

async function GetProvidersPerSpec(chainId: string): Promise<ProviderPerSpecResponse> {
    return QueryLavaRPC<ProviderPerSpecResponse>(`/lavanet/lava/pairing/providers/${chainId}`);
}

async function getAllProviders(): Promise<string[]> {
    const chainsResponse = await GetAllChains();
    const uniqueChains = [...new Set(chainsResponse.chainInfoList.map(chain => chain.chainID))];
    let allProviders: string[] = [];
    for (const chainID of uniqueChains) {
        const providers = await GetProvidersPerSpec(chainID);
        const providerAddresses = providers.stakeEntry.map(provider => provider.address);
        allProviders = allProviders.concat(providerAddresses);
    }
    return [...new Set(allProviders)];
}

async function GetAllValidators(): Promise<string[]> {
    let validatorAddresses: string[] = [];
    let nextKey: string | null = null;

    do {
        const queryParams = nextKey ? `?pagination.key=${encodeURIComponent(nextKey)}` : '';
        const response = await QueryLavaRPC<AllValidatorsResponse>(`/cosmos/staking/v1beta1/validators${queryParams}`);
        
        validatorAddresses = validatorAddresses.concat(response.validators.map(validator => validator.operator_address));
        nextKey = response.pagination.next_key;
    } while (nextKey);

    return validatorAddresses;
}

async function GetEstimatedValidatorRewards(validator: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
    return QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_validator_rewards/${validator}/${amount}${denom}`, true);
}

async function GetEstimatedProviderRewards(provider: string, amount: number, denom: string): Promise<EstimatedRewardsResponse> {
  return QueryLavaRPC<EstimatedRewardsResponse>(`/lavanet/lava/subscription/estimated_provider_rewards/${provider}/${amount}${denom}`, true);
}

async function GetDenomTrace(denom: string): Promise<DenomTraceResponse> {
    return QueryLavaRPC<DenomTraceResponse>(`/ibc/apps/transfer/v1/denom_traces/${denom}`);
}

async function getCoinGeckoDenomToUSDCRate(denom: string): Promise<number> {

    const coinGeckodenom = denomsData[denom];
    if (!coinGeckodenom) {
        throw new Error(`No matching id found in denoms.json for ${denom}`);
    }

    const cachedRate = await MemoryCache.getDict(`coingecko-rate-${coinGeckodenom}`);
    if (cachedRate) {
        return cachedRate.rate;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckodenom}&vs_currencies=usd`;
    const data = await fetchData<{ [coinGeckodenom: string]: { usd: number } }>(url, {}, false, 3, 2, 1200, 5000);
    const usdcRate = data[coinGeckodenom]?.usd;
    if (!usdcRate) {
        throw new Error(`No USD rate found for ${coinGeckodenom}`);
    }

    await MemoryCache.setDict(`coingecko-rate-${coinGeckodenom}`, { rate: usdcRate }, CACHE_DURATION.COINGECKO_RATE);
    return usdcRate;
}

export async function GetBasePrice(amount: string, denom: string): Promise<[number, string]> {
    let baseAmount = parseFloat(amount);
    let baseDenom = denom;
    
    if (baseDenom.startsWith("ibc/")) {

        const cachedValue = await MemoryCache.getDict(`denom-${denom}`);
        if (cachedValue) {
            baseDenom = cachedValue.baseDenom;
        }

        else {
            const denomWithoutPrefix = denom.slice(4);
            const denomTrace = await GetDenomTrace(denomWithoutPrefix);
            baseDenom = denomTrace.denom_trace.base_denom;
            await MemoryCache.setDict(`denom-${denom}`, { baseDenom }, CACHE_DURATION.DENOM_TRACE); // cache for 1 day
        }
    }

    if (baseDenom in DENOM_CONVERSIONS) {
        const { baseDenom: newBaseDenom, factor } = DENOM_CONVERSIONS[baseDenom];
        baseDenom = newBaseDenom;
        baseAmount = baseAmount / factor;
    }

    return [baseAmount, baseDenom];
}

export async function GetUSDCValue(amount: number, denom: string): Promise<number> {
    const usdcRate = await getCoinGeckoDenomToUSDCRate(denom);
    return amount * usdcRate;
}

export async function CalculateAPR(totalReward: number): Promise<number> {
    const investedAmount = await GetUSDCValue(BENCHMARK_AMOUNT / 1000000, "lava");
    const rate = totalReward / investedAmount;
    const APR = ((1 + rate) ** 12 - 1)
    return APR
}

async function calculateAPRForEntities(
  getEntities: () => Promise<string[]>,
  getEstimatedRewards: (entity: string) => Promise<EstimatedRewardsResponse>
): Promise<number> {
  const totalRewards = new Map<string, number>();
  const totalAPRs = new Map<string, number>();

  try {
    const entities = await getEntities();
    for (const entity of entities) {
      const estimatedRewards = await getEstimatedRewards(entity);

      for (const total of estimatedRewards.total) {

          // in testnet we might find some rewards withtest-denoms that don't really exist,
          // so no need to fail the whole process here
          if (TEST_DENOMS.includes(total.denom)) {
            continue;
          }

          const [amount, denom] = await GetBasePrice(total.amount, total.denom);
          const usdcAmount = await GetUSDCValue(amount, denom);

          const currentReward = totalRewards.get(entity) || 0;
          totalRewards.set(entity, currentReward + usdcAmount);
      }
    }

    // Calculate APRs for each entity
    for (const [entityId, totalReward] of totalRewards.entries()) {
      const APR = await CalculateAPR(totalReward);
      totalAPRs.set(entityId, APR);
    }

    return calculatePercentile(Array.from(totalAPRs.values()), PERCENTILE);
  } catch (error) {
    logger.error('Error processing APR', { error });
    throw error;
  }
}

export async function ProcessRestakingAPR(): Promise<number> {
  return calculateAPRForEntities(
    getAllProviders,
    (provider) => GetEstimatedProviderRewards(provider, BENCHMARK_AMOUNT, BENCHMARK_DENOM)
  );
}

export async function ProcessStakingAPR(): Promise<number> {
  return calculateAPRForEntities(
    GetAllValidators,
    (validator) => GetEstimatedValidatorRewards(validator, BENCHMARK_AMOUNT, BENCHMARK_DENOM)
  );
}

export async function ProcessAPR(db: PostgresJsDatabase): Promise<void> {
  const now = new Date();

  const [restakingAPR, stakingAPR] = await Promise.all([
    ProcessRestakingAPR(),
    ProcessStakingAPR()
  ]);

  logger.debug(`ProcessRestakingAPR: ${restakingAPR}`);
  logger.debug(`ProcessStakingAPR: ${stakingAPR}`);

  const aprRows: JsinfoSchema.InsertApr[] = [
    { key: 'restaking_apr_percentile', value: restakingAPR, timestamp: now },
    { key: 'staking_apr_percentile', value: stakingAPR, timestamp: now }
  ];

  await db.transaction(async (tx) => {
    for (const row of aprRows) {
      await tx.insert(JsinfoSchema.apr)
        .values(row as any)
        .onConflictDoUpdate({
          target: [JsinfoSchema.apr.key],
          set: {
            value: row.value,
            timestamp: row.timestamp,
          } as any
        });
    }
  });
}