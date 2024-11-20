import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, gt, isNull, not, sql } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { RedisResourceBase } from '../../RedisResourceBase';

export class ActiveProvidersResource extends RedisResourceBase<string[], {}> {
    protected readonly redisKey = 'index:active_providers';
    protected readonly ttlSeconds = 600; // 10 minutes cache

    protected async fetchFromDb(db: PostgresJsDatabase): Promise<string[]> {
        const data = await db
            .select({
                provider: JsinfoSchema.providerStakes.provider,
            })
            .from(JsinfoSchema.providerStakes)
            .leftJoin(JsinfoProviderAgrSchema.aggDailyRelayPayments,
                and(
                    eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
                    eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId)
                )
            )
            .where(
                and(
                    and(
                        not(eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Frozen)),
                        not(isNull(JsinfoSchema.providerStakes.provider)),
                    ),
                    not(eq(JsinfoSchema.providerStakes.provider, ''))
                ))
            .groupBy(JsinfoSchema.providerStakes.provider)
            .having(
                and(
                    gt(sql<number>`MAX(${JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday})`, sql`NOW() - INTERVAL '30 day'`),
                    gt(sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.relaySum}), 0)`, 1)
                )
            );

        return data.map(item => item.provider).filter((provider): provider is string => provider !== null);
    }
} 