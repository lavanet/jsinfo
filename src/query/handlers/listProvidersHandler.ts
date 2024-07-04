// src/query/handlers/ListProvidersRawHandler.ts

// curl http://localhost:8081/cacheLinks | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock, QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { isNotNull, eq } from "drizzle-orm";

export const ListProvidersRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
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
                                            moniker: { type: 'string' }
                                        },
                                        required: ['spec', 'moniker']
                                    }
                                }
                            },
                            required: ['provider', 'specs']
                        }
                    }
                }
            }
        }
    }
}

interface ProviderEntry {
    provider: string;
    specs: {
        chain: string;
        spec: string | null;
        moniker: string | null;
    }[];
}

const chainMapping: Record<string, string> = {
    ALFAJORES: "CELO",
    APT1: "APTOS",
    ARB1: "ARIBTRUM",
    ARBN: "ARIBTRUM",
    AXELAR: "AXELAR",
    AXELART: "AXELAR",
    BASE: "BASE",
    BASET: "BASE",
    BSC: "BSC",
    BSCT: "BSC",
    CANTO: "CANTO",
    CELO: "CELO",
    COS3: "COSMOS",
    COS4: "COSMOS",
    COS5: "COSMOS",
    COS5T: "COSMOS",
    COSHUB: "COSMOS",
    COSHUBT: "COSMOS",
    COSMOSSDK: "COSMOS",
    COSMOSSDK45DEP: "COSMOS",
    COSMOSSDKFULL: "COSMOS",
    COSMOSWASM: "COSMOS",
    COSMOSHUB: "COSMOS",
    COSMOSHUBT: "COSMOS",
    ETHERMINT: "COSMOS",
    TENDERMINT: "COSMOS",
    ETH1: "ETHEREUM",
    HOL1: "ETHEREUM",
    EVMOS: "EVMOS",
    EVMOST: "EVMOS",
    FTM250: "FANTOM",
    FTM4002: "FANTOM",
    FVM: "FILECOIN",
    GTH1: "ETHEREUM",
    IBC: "COSMOS",
    JUN1: "JUNO",
    JUNT1: "JUNO",
    LAV1: "LAVA",
    OPTM: "OPTIMISM",
    OPTMT: "OPTIMISM",
    OSMO: "OSMOSIS",
    OSMOT: "OSMOSIS",
    POLYGON1: "PLOYGON",
    POLYGON1T: "PLOYGON",
    SOLANA: "SOLANA",
    SOLANAT: "SOLANA",
    STRK: "STARKNET",
    STRKT: "STARKNET",
    SUIT: "SUI",
    SUI: "SUI",
    NEAR: "NEAR",
    NEART: "NEAR",
    SEP1: "ETHEREUM",
    ARBS: "ARIBTRUM",
    OPTMS: "OPTIMISM",
    STRKS: "STARKNET",
    AGR: "AGORIC",
    AGRT: "AGORIC",
    KOII: "KOII",
    KOIIT: "KOII",
    BERAT: "BERACHAIN",
    SQDSUBGRAPH: "SUBSQUID",
    FUSE: "FUSE",
    FUSET: "FUSE",
    STRGZ: "STARGAZE",
    STRGZT: "STARGAZE",
    BLAST: "BLAST",
    BLASTSP: "BLAST",
    SECRET: "SECRET",
    SECRETP: "SECRET",
    AVAX: "AVALANCHE",
    AVAXT: "AVALANCHE",
    OSMOSIS: "OSMOSIS",
    OSMOSIST: "OSMOSIS",
    CELESTIA: "CELESTIA",
    CELESTIATA: "CELESTIA",
    CELESTIATM: "CELESTIA",
    UNIONT: "UNION",
    UNION: "UNION",
    ETHBEACON: "ETHEREUM"
};

export async function ListProvidersRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoReadDbInstance()

    const stakesRes = await QueryGetJsinfoReadDbInstance().select({
        provider: JsinfoSchema.providerStakes.provider,
        specId: JsinfoSchema.providerStakes.specId,
        moniker: JsinfoSchema.providers.moniker,
    }).from(JsinfoSchema.providerStakes)
        .leftJoin(JsinfoSchema.providers, eq(JsinfoSchema.providerStakes.provider, JsinfoSchema.providers.address))
        .where(isNotNull(JsinfoSchema.providers.address));

    const providers = stakesRes.reduce<ProviderEntry[]>((acc, stake) => {
        const providerEntry = acc.find(entry => entry.provider === stake.provider);
        const specEntry = {
            chain: chainMapping[stake.specId!] || "",
            spec: stake.specId,
            moniker: stake.moniker,
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
    }, []);

    const { latestHeight, latestDatetime } = await GetLatestBlock()
    return reply.send({
        height: latestHeight,
        datetime: latestDatetime,
        providers
    });
}