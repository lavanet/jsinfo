import { desc } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';

export interface ProviderStakeInfo {
    stake: string;
    delegateTotal: string;
}

export interface ProviderStakesAndDelegationData {
    stakeSum: string;
    delegationSum: string;
    stakeTotalSum: string;
    providerStakes: Record<string, ProviderStakeInfo>;
}

export class ProviderStakesAndDelegationResource extends RedisResourceBase<ProviderStakesAndDelegationData, {}> {
    protected readonly redisKey = 'ProviderStakesAndDelegationResource';
    protected readonly cacheExpirySeconds = 600; // 10 minutes cache

    protected async fetchFromSource(): Promise<ProviderStakesAndDelegationData> {
        const stakesRes = await queryJsinfo(db => db.select({
            provider: JsinfoSchema.providerStakes.provider,
            stake: JsinfoSchema.providerStakes.stake,
            delegateTotal: JsinfoSchema.providerStakes.delegateTotal,
        })
            .from(JsinfoSchema.providerStakes)
            .orderBy(desc(JsinfoSchema.providerStakes.stake)),
            'ProviderStakesAndDelegationResource::fetchFromSource'
        );

        let stakeSum = 0n;
        let delegationSum = 0n;
        const providerStakes: Record<string, ProviderStakeInfo> = {};

        stakesRes.forEach((stake) => {
            if (!stake.provider || !stake.stake || !stake.delegateTotal) return;

            stakeSum += stake.stake;
            delegationSum += stake.delegateTotal;

            providerStakes[stake.provider] = {
                stake: stake.stake.toString(),
                delegateTotal: stake.delegateTotal.toString()
            };
        });

        return {
            stakeSum: stakeSum.toString(),
            delegationSum: delegationSum.toString(),
            stakeTotalSum: (stakeSum + delegationSum).toString(),
            providerStakes
        };
    }
} 