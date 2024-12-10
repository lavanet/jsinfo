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

        // Initialize with 30-day stats instead of all-time stats
        thirtyDaysStats
            .filter((stat): stat is { chainId: string; relaySum: number; cuSum: number; } => stat.chainId !== null)
            .forEach(stat => {
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