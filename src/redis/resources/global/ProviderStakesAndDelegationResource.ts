import { desc } from 'drizzle-orm';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { queryJsinfo } from '@jsinfo/utils/db';
import { IsMeaningfulText } from '@jsinfo/utils/fmt';

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
            if (stake.provider !== null && !IsMeaningfulText(stake.provider)) return;

            stakeSum += stake.stake || 0n;
            delegationSum += stake.delegateTotal || 0n;

            providerStakes[stake.provider!] = {
                stake: (stake.stake || 0n).toString(),
                delegateTotal: (stake.delegateTotal || 0n).toString()
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