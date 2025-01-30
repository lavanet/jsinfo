import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { desc, inArray } from 'drizzle-orm';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface ProviderEntry {
    provider: string;
    specs: {
        chain: string;
        spec: string | null;
        stakestatus: string | null;
        stake: string | null;
        addons: string | null;
        extensions: string | null;
        delegateCommission: string | null;
        delegateTotal: string | null;
        moniker: string;
    }[];
}

export interface ProvidersData {
    height: number;
    datetime: number;
    providers: ProviderEntry[];
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

const LavaProviderStakeStatusDict: { [key: number]: string } = {
    [JsinfoSchema.LavaProviderStakeStatus.Active]: "Active",
    [JsinfoSchema.LavaProviderStakeStatus.Frozen]: "Frozen",
    [JsinfoSchema.LavaProviderStakeStatus.Unstaking]: "Unstaking",
    [JsinfoSchema.LavaProviderStakeStatus.Inactive]: "Inactive",
    [JsinfoSchema.LavaProviderStakeStatus.Jailed]: "Jailed",
};
export class ListProvidersResource extends RedisResourceBase<ProvidersData, {}> {
    protected redisKey = 'listProviders';
    protected cacheExpirySeconds = 300; // 5 minutes cache

    protected async fetchFromSource(): Promise<ProvidersData> {
        const stakesRes = await queryJsinfo(
            async (db) => db.select({
                provider: JsinfoSchema.providerStakes.provider,
                specId: JsinfoSchema.providerStakes.specId,
                status: JsinfoSchema.providerStakes.status,
                stake: JsinfoSchema.providerStakes.stake,
                addons: JsinfoSchema.providerStakes.addons,
                extensions: JsinfoSchema.providerStakes.extensions,
                delegateCommission: JsinfoSchema.providerStakes.delegateCommission,
                delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
            }).from(JsinfoSchema.providerStakes)
                .where(inArray(JsinfoSchema.providerStakes.status, [JsinfoSchema.LavaProviderStakeStatus.Active, JsinfoSchema.LavaProviderStakeStatus.Frozen, JsinfoSchema.LavaProviderStakeStatus.Jailed])),
            'ListProvidersResource_fetchFromSource'
        );

        // First get all monikers
        const monikerPromises = stakesRes.map(stake =>
            ProviderMonikerService.GetMonikerForSpec(stake.provider, stake.specId)
        );
        const monikers = await Promise.all(monikerPromises);

        // Then use them in reduce
        const providers = stakesRes.reduce<ProviderEntry[]>((acc, stake, index) => {
            const providerEntry = acc.find(entry => entry.provider === stake.provider);
            const specEntry = {
                chain: stake.specId ? chainMapping[stake.specId] || "" : "",
                spec: stake.specId || '',
                stakestatus: stake.status ? LavaProviderStakeStatusDict[stake.status] || "" : "",
                stake: stake.stake?.toString() ?? '',
                addons: stake.addons || '',
                extensions: stake.extensions || '',
                delegateCommission: stake.delegateCommission?.toString() ?? '',
                delegateTotal: stake.delegateTotal?.toString() ?? '',
                moniker: monikers[index],
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

        const latestDbBlocks = await queryJsinfo(
            async (db) => db.select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1),
            'ListProvidersResource_latestDbBlocks'
        );
        let latestHeight = 0
        let latestDatetime = 0
        if (latestDbBlocks.length != 0) {
            latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
            latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
        }

        return {
            height: latestHeight,
            datetime: latestDatetime,
            providers
        };
    }
} 