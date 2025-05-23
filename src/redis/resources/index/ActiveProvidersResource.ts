import { and, eq, gt, isNull, not, sql } from 'drizzle-orm';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { queryJsinfo } from '@jsinfo/utils/db';

export class ActiveProvidersResource extends RedisResourceBase<string[], {}> {
    protected readonly redisKey = 'index:active_providers';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    protected async fetchFromSource(): Promise<string[]> {
        const data = await queryJsinfo(db => db.select({
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
                        eq(JsinfoSchema.providerStakes.status, JsinfoSchema.LavaProviderStakeStatus.Active),
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
            ),
            'ActiveProvidersResource::fetchFromSource'
        );

        return data
            .map(item => item.provider)
            .filter((provider): provider is string => provider !== null)
            .map(provider => provider.toString());
    }
}

export const ActiveProvidersService = new ActiveProvidersResource();