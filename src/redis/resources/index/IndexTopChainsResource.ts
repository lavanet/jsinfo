import { sql, gt } from "drizzle-orm";
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface IndexTopChainsData {
    allSpecs: {
        chainId: string;
        relaySum30Days: number;
        cuSum30Days: number;
        relaySum: number;
        cuSum: number;
    }[];
}

export class IndexTopChainsResource extends RedisResourceBase<IndexTopChainsData, {}> {
    protected readonly redisKey = 'index:top:chains';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    protected async fetchFromSource(): Promise<IndexTopChainsData> {
        // Get 30 days stats
        const thirtyDaysStats = await queryJsinfo(
            async (db: PostgresJsDatabase) => db.select({
                chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
                relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
                cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            })
                .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .where(gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '30 day'`))
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
            'IndexTopChainsResource_fetchFromSource_30days'
        );
        
        // Get all time stats
        const allTimeStats = await queryJsinfo(
            async (db: PostgresJsDatabase) => db.select({
                chainId: JsinfoProviderAgrSchema.aggDailyRelayPayments.specId,
                relaySum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum})`,
                cuSum: sql<number>`SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum})`,
            })
                .from(JsinfoProviderAgrSchema.aggDailyRelayPayments)
                .groupBy(JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
            'IndexTopChainsResource_fetchFromSource_alltime'
        );

        // Combine results
        const statsMap = new Map<string, {
            chainId: string;
            relaySum30Days: number;
            cuSum30Days: number;
            relaySum: number;
            cuSum: number;
        }>();

        // add here custom logic to remove these chains:
        const mainnetChains = [
            "FVM",
            "FVMT",
            "STRK",
            "STRKS",
            "AXELAR",
            "AXELART",
            "ARBITRUM",
            "ARBITRUMS",
            "MOVEMENT",
            "MOVEMENTT",
            "NEAR",
            "NEART",
            "COSMOSHUB",
            "COSMOSHUBT",
            "LAVA",
            "ETH1",
            "Sep1",
            "HOL1",
            "BASE",
            "BASES",
            "OPTM",
            "OPTMS",
            "BSC",
            "BSCT",
            "POLYGON",
            "POLYGONA",
            "SOLANA",
            "SOLANAT",
            "HYPERLIQUID",
            "HYPERLIQUIDT",
            "HADERA"
        ].map(chain => chain.toLowerCase().trim());

        const testnetChains = [
            "LAV1",
            "APT1",
            "ETH1",
            "SOLANA",
            "NEAR"
        ].map(chain => chain.toLowerCase().trim());

        // Initialize with 30-day stats instead of all-time stats
        const filteredStats = thirtyDaysStats
            .filter((stat): stat is { chainId: string; relaySum: number; cuSum: number; } =>
                stat.chainId !== null && (mainnetChains.includes(stat.chainId.toLowerCase().trim()) || testnetChains.includes(stat.chainId.toLowerCase().trim())));
        
        // Manually add HEDERA if it's not in the 30-day stats
        // const hasHedera = filteredStats.some(stat => stat.chainId.toLowerCase() === 'hedera');
        // if (!hasHedera) {
        //     filteredStats.push({ chainId: "hedera", relaySum: 0, cuSum: 0 });
        // }

        // Log what got filtered out
        const allChainIds = thirtyDaysStats
            .filter((stat): stat is { chainId: string; relaySum: number; cuSum: number; } => stat.chainId !== null)
            .map(stat => stat.chainId);

        const filteredOutChains = allChainIds.filter(chainId =>
            !mainnetChains.includes(chainId.toLowerCase().trim()) && !testnetChains.includes(chainId.toLowerCase().trim())
        );

        // Debug: Check if hedera is in the raw data
        const hederaInRawData = allChainIds.some(chainId => chainId.toLowerCase() === 'hedera');
        console.log(`IndexTopChainsResource: HEDERA in raw 30-day data: ${hederaInRawData}`);
        console.log(`IndexTopChainsResource: All chain IDs from 30-day query: ${allChainIds.join(', ')}`);

        if (filteredOutChains.length > 0) {
            console.log(`IndexTopChainsResource: Filtered out chains: ${filteredOutChains.join(', ')}`);
        }

        filteredStats.forEach(stat => {
            statsMap.set(stat.chainId, {
                chainId: stat.chainId,
                relaySum30Days: Number(stat.relaySum) || 0,
                cuSum30Days: Number(stat.cuSum) || 0,
                relaySum: 0,  // Will be updated with all-time stats
                cuSum: 0
            });
        });

        // Add all-time stats only for chains that exist in 30-day window
        allTimeStats
            .filter((stat): stat is { chainId: string; relaySum: number; cuSum: number; } =>
                stat.chainId !== null && statsMap.has(stat.chainId))
            .forEach(stat => {
                const existing = statsMap.get(stat.chainId)!;
                existing.relaySum = Number(stat.relaySum) || 0;
                existing.cuSum = Number(stat.cuSum) || 0;
            });

        return {
            allSpecs: Array.from(statsMap.values())
                .sort((a, b) => b.relaySum30Days - a.relaySum30Days) // Sort by 30-day relays
        };
    }
} 