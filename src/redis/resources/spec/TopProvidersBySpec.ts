import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { and, eq, desc, inArray, gt } from 'drizzle-orm';
import { queryJsinfo } from '@jsinfo/utils/db';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoProviderAgrSchema from '@jsinfo/schemas/jsinfoSchema/providerRelayPaymentsAgregation';
import { ActiveProvidersService } from '@jsinfo/redis/resources/index/ActiveProvidersResource';
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { GetDataLength } from '@jsinfo/utils/fmt';
import { sql } from 'drizzle-orm';

export interface TopProvidersBySpecFilterParams {
    spec: string;
}

export interface TopProvidersBySpecResponse {
    providers: { [key: string]: string };
    error?: string;
}

export class TopProvidersBySpecResource extends RedisResourceBase<TopProvidersBySpecResponse, TopProvidersBySpecFilterParams> {
    protected readonly redisKey = 'top_10_provider_by_spec';
    protected readonly cacheExpirySeconds = 1200; // 20 minutes

    protected async fetchFromSource(args: TopProvidersBySpecFilterParams): Promise<TopProvidersBySpecResponse> {
        try {
            const activeProviders = await ActiveProvidersService.fetch();
            if (GetDataLength(activeProviders) === 0 || !activeProviders) {
                return { providers: {}, error: 'No active providers found' };
            }

            // Get top 10 providers by CUs in last 90 days
            const top10Providers = await queryJsinfo(
                async (db) => await db.select({
                    provider: JsinfoSchema.providerStakes.provider,
                    cuSum90Days: sql<number>`COALESCE(SUM(${JsinfoProviderAgrSchema.aggDailyRelayPayments.cuSum}), 0) as "cuSum90Days"`,
                })
                    .from(JsinfoSchema.providerStakes)
                    .leftJoin(
                        JsinfoProviderAgrSchema.aggDailyRelayPayments,
                        and(
                            eq(JsinfoSchema.providerStakes.provider, JsinfoProviderAgrSchema.aggDailyRelayPayments.provider),
                            and(
                                eq(JsinfoSchema.providerStakes.specId, JsinfoProviderAgrSchema.aggDailyRelayPayments.specId),
                                gt(JsinfoProviderAgrSchema.aggDailyRelayPayments.dateday, sql<Date>`now() - interval '90 day'`)
                            )
                        )
                    )
                    .where(
                        and(
                            eq(JsinfoSchema.providerStakes.specId, args.spec),
                            inArray(JsinfoSchema.providerStakes.provider, activeProviders)
                        )
                    )
                    .groupBy(JsinfoSchema.providerStakes.provider, JsinfoSchema.providerStakes.specId)
                    .orderBy(desc(sql<number>`"cuSum90Days"`))
                    .limit(10),
                `TopProvidersBySpec_fetch_${args.spec}`
            );

            // Validate providers
            if (top10Providers.some(item => !item.provider)) {
                throw new Error("Invalid provider found");
            }

            // Get monikers for providers
            const providers: { [key: string]: string } = {};
            for (const item of top10Providers) {
                const moniker = await ProviderMonikerService.GetMonikerForSpec(item.provider, args.spec);
                if (item.provider) {
                    if (moniker) {
                        providers[item.provider] = moniker;
                    } else {
                        providers[item.provider] = item.provider;
                    }
                }
            }

            return { providers };
        } catch (error) {
            return {
                providers: {},
                error: `Failed to fetch top providers: ${error}`
            };
        }
    }
}

export const TopProvidersBySpecService = new TopProvidersBySpecResource(); 