// src/query/handlers/ListProvidersRawHandler.ts

// curl http://localhost:8081/listProviders | jq
// curl http://localhost:8081/listProviders | jq | grep ">"

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { MonikerCache } from '../classes/MonikerCache';

export const ListProvidersRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'object',
                        properties: {
                            height: { type: 'number' },
                            datetime: { type: 'number' },
                            providers: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        provider: { type: 'string' },
                                        specs: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    chain: { type: 'string' },
                                                    spec: { type: 'string' },
                                                    moniker: { type: 'string' },
                                                    monikerfull: { type: 'string' }
                                                },
                                                required: ['spec', 'moniker']
                                            }
                                        }
                                    },
                                    required: ['provider', 'specs']
                                }
                            }
                        },
                        required: ['height', 'datetime', 'providers']
                    }
                }
            }
        }
    }
};

interface ProviderEntry {
    provider: string;
    specs: {
        chain: string;
        spec: string | null;
        moniker: string | null;
        monikerfull: string | null;
    }[];
}

const chainMapping: Record<string, string> = {
    FUSE: "fuse mainnet",
    STRK: "starknet mainnet",
    STRKS: "starknet sepolia testnet",
    LAVA: "lava mainnet",
    AVAX: "avalanche mainnet",
    AVAXT: "avalanche testnet",
    OSMOSIS: "osmosis mainnet",
    OSMOSIST: "osmosis testnet",
    NEAR: "near mainnet",
    NEART: "near testnet",
    SUIT: "sui devnet",
    FUELNETWORK: "fuel network graphql",
    COSMOSSDK45DEP: "cosmos sdk deprecated apis",
    SOLANA: "solana main net",
    SOLANAT: "solana test net",
    SCROLL: "scroll mainnet",
    SCROLLS: "scroll sepolia testnet",
    EVMOS: "evmos mainnet",
    EVMOST: "evmos testnet",
    TENDERMINT: "tendermint",
    CANTO: "canto mainnet",
    COSMOSHUB: "cosmos hub mainnet",
    COSMOSHUBT: "cosmos hub testnet",
    COSMOSWASM: "cosmos wasm",
    FVM: "fvm mainnet",
    FTM250: "fantom mainnet",
    FTM4002: "fantom testnet",
    SQDSUBGRAPH: "subsquid powered subgraph",
    BERAT: "berachain testnet",
    MOVEMENT: "movement mainnet",
    MANTAPACIFIC: "manta pacific mainnet",
    MANTAPACIFICT: "manta pacific testnet",
    ETH1: "ethereum mainnet",
    SEP1: "ethereum testnet sepolia",
    HOL1: "ethereum testnet holesky",
    JUN1: "juno mainnet",
    JUNT1: "juno testnet",
    BSC: "bsc mainnet",
    BSCT: "bsc testnet",
    COSMOSSDKFULL: "full cosmos sdk",
    IBC: "ibc",
    SIDET: "side testnet",
    MORALIS: "moralis advanced api",
    CELESTIA: "celestia mainnet",
    CELESTIATM: "celestia mocha testnet",
    CELESTIATA: "celestia arabica testnet",
    KOII: "koii main net",
    KOIIT: "koii test net",
    MANTLE: "mantle testnet",
    LAV1: "lava testnet",
    AXELAR: "axelar mainnet",
    AXELART: "axelar testnet",
    AGR: "agoric mainnet",
    AGRT: "agoric testnet",
    ETHBEACON: "ethereum beacon mainnet",
    BASE: "base mainnet",
    BASES: "base sepolia testnet",
    BASET: "base sepolia testnet",
    ZKSYNC: "zksync era mainnet",
    ZKSYNCSP: "zksync era sepolia testnet",
    ETHERMINT: "ethermint",
    SECRET: "secret mainnet",
    SECRETP: "secret testnet",
    APT1: "aptos mainnet",
    OPTM: "optimism mainnet",
    OPTMS: "optimism sepolia testnet",
    ARB1: "arbitrum mainnet",
    ARBN: "arbitrum nova testnet",
    ARBS: "arbitrum sepolia testnet",
    KAKAROTT: "kakarot sepolia testnet",
    BLAST: "blast mainnet",
    BLASTSP: "blast sepolia testnet",
    CELO: "celo mainnet",
    ALFAJORES: "celo alfajores testnet",
    UNIONT: "union testnet",
    STRGZ: "stargaze mainnet",
    STRGZT: "stargaze testnet",
    NAMTSE: "namada se testnet",
    COSMOSSDK: "cosmos sdk",
    POLYGON1: "polygon mainnet",
    POLYGON1A: "polygon amoy testnet",
    COS3: "osmosis mainnet",
    COS4: "osmosis testnet",
    COS5: "cosmos hub mainnet",
    COS5T: "cosmos hub testnet",
    COSHUB: "cosmos hub mainnet",
    COSHUBT: "cosmos hub testnet",
    GTH1: "ethereum testnet goerli",
    OPTMT: "optimism goerli testnet",
    OSMO: "osmosis mainnet",
    OSMOT: "osmosis testnet",
    POLYGON1T: "polygon testnet",
    STRKT: "starknet testnet",
    SUI: "sui devnet",
    FUSET: "fuse testnet",
    UNION: "union mainnet",
};

export async function ListProvidersRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const stakesRes = await QueryGetJsinfoReadDbInstance().select({
        provider: JsinfoSchema.providerStakes.provider,
        specId: JsinfoSchema.providerStakes.specId,
    }).from(JsinfoSchema.providerStakes)
        .where(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active));

    const providers = stakesRes.reduce<ProviderEntry[]>((acc, stake) => {
        const providerEntry = acc.find(entry => entry.provider === stake.provider);
        const specEntry = {
            chain: chainMapping[stake.specId!] || "",
            spec: stake.specId,
            moniker: MonikerCache.GetMonikerForProvider(stake.provider),
            monikerfull: MonikerCache.GetMonikerFullDescription(stake.provider),
        };
        if (providerEntry) {
            providerEntry.specs.push(specEntry);
        } else {
            acc.push({
                provider: stake.provider!,
                specs: [specEntry]
            });
        }
        return acc;
    }, []).sort((a, b) => a.provider.localeCompare(b.provider));

    const { latestHeight, latestDatetime } = await GetLatestBlock()

    return {
        data: {
            height: latestHeight,
            datetime: latestDatetime,
            providers
        }
    };
}