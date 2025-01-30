const chainMapping: Record<string, string> = {
    ETH1: "Ethereum Mainnet",
    EVMOS: "Evmos Mainnet",
    NEAR: "NEAR Mainnet",
    NEART: "NEAR Testnet",
    EVMOST: "Evmos Testnet",
    ARB1: "Arbitrum Mainnet",
    POLYGON: "Polygon Mainnet",
    POLYGON1: "Polygon Mainnet",
    CELO: "Celo Mainnet",
    STRK: "Starknet Mainnet",
    STRKS: "Starknet Sepolia Testnet",
    LAVA: "Lava Mainnet",
    AVAX: "Avalanche Mainnet",
    AVAXT: "Avalanche Testnet",
    OSMOSIS: "Osmosis Mainnet",
    OSMOSIST: "Osmosis Testnet",
    SUIT: "Sui Devnet",
    FUELNETWORK: "Fuel Network GraphQL",
    COSMOSSDK45DEP: "Cosmos SDK Deprecated APIs",
    SOLANA: "Solana Mainnet",
    SOLANAT: "Solana Testnet",
    SCROLL: "Scroll Mainnet",
    SCROLLS: "Scroll Sepolia Testnet",
    TENDERMINT: "Tendermint",
    CANTO: "Canto Mainnet",
    COSMOSHUB: "Cosmos Hub Mainnet",
    COSMOSHUBT: "Cosmos Hub Testnet",
    COSMOSWASM: "CosmWasm",
    FVM: "Filecoin Mainnet",
    FTM250: "Fantom Mainnet",
    FTM4002: "Fantom Testnet",
    SQDSUBGRAPH: "Subsquid Powered Subgraph",
    BERAT: "Berachain Testnet",
    MOVEMENT: "Movement Mainnet",
    MANTAPACIFIC: "Manta Pacific Mainnet",
    MANTAPACIFICT: "Manta Pacific Testnet",
    SEP1: "Ethereum Sepolia Testnet",
    HOL1: "Ethereum Holesky Testnet",
    JUN1: "Juno Mainnet",
    JUNT1: "Juno Testnet",
    BSC: "Binance Smart Chain Mainnet",
    BSCT: "Binance Smart Chain Testnet",
    COSMOSSDKFULL: "Cosmos SDK Full",
    IBC: "Inter-Blockchain Communication",
    SIDET: "Side Testnet",
    MORALIS: "Moralis Advanced API",
    CELESTIA: "Celestia Mainnet",
    CELESTIATM: "Celestia Mocha Testnet",
    CELESTIATA: "Celestia Arabica Testnet",
    KOII: "Koii Mainnet",
    KOIIT: "Koii Testnet",
    MANTLE: "Mantle Testnet",
    LAV1: "Lava Testnet",
    AXELAR: "Axelar Mainnet",
    AXELART: "Axelar Testnet",
    AGR: "Agoric Mainnet",
    AGRT: "Agoric Testnet",
    ETHBEACON: "Ethereum Beacon Mainnet",
    BASE: "Base Mainnet",
    BASES: "Base Sepolia Testnet",
    BASET: "Base Sepolia Testnet",
    ZKSYNC: "zkSync Era Mainnet",
    ZKSYNCSP: "zkSync Era Sepolia Testnet",
    ETHERMINT: "Ethermint",
    SECRET: "Secret Mainnet",
    SECRETP: "Secret Testnet",
    APT1: "Aptos Mainnet",
    OPTM: "Optimism Mainnet",
    OPTMS: "Optimism Sepolia Testnet",
    ARBN: "Arbitrum Nova Testnet",
    ARBS: "Arbitrum Sepolia Testnet",
    KAKAROTT: "Kakarot Sepolia Testnet",
    BLAST: "Blast Mainnet",
    BLASTSP: "Blast Special",
    ALFAJORES: "Celo Alfajores Testnet",
    UNIONT: "Union Testnet",
    STRGZ: "Stargaze Mainnet",
    STRGZT: "Stargaze Testnet",
    NAMTSE: "Namada SE Testnet",
    COSMOSSDK: "Cosmos SDK",
    POLYGON1A: "Polygon Amoy Testnet",
    COS3: "Osmosis Mainnet",
    COS4: "Osmosis Testnet",
    COS5: "Cosmos Hub Mainnet",
    COS5T: "Cosmos Hub Testnet",
    COSHUB: "Cosmos Hub Mainnet",
    COSHUBT: "Cosmos Hub Testnet",
    GTH1: "Ethereum Goerli Testnet",
    OPTMT: "Optimism Goerli Testnet",
    OSMO: "Osmosis Mainnet",
    OSMOT: "Osmosis Testnet",
    POLYGON1T: "Polygon Testnet",
    STRKT: "Starknet Testnet",
    SUI: "Sui Devnet",
    FUSET: "Fuse Testnet",
    UNION: "Union Mainnet"
};

/**
 * Converts a chain abbreviation to its full name
 * @param abbreviation The chain abbreviation (e.g. "ETH1", "EVMOS")
 * @returns The full chain name or empty string if not found
 */
export function ConvertToChainName(abbreviation: string): string {
    if (typeof abbreviation !== 'string') {
        return '';
    }
    return chainMapping[abbreviation.toUpperCase()] || '';
}

export default chainMapping;