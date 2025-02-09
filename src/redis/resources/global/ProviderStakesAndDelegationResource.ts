import { desc, sql } from 'drizzle-orm';
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
            stake: sql<bigint>`sum(${JsinfoSchema.providerStakes.stake})`,
            delegateTotal: sql<bigint>`sum(${JsinfoSchema.providerStakes.delegateTotal})`,
        })
            .from(JsinfoSchema.providerStakes).groupBy(JsinfoSchema.providerStakes.provider),
            'ProviderStakesAndDelegationResource::fetchFromSource'
        );

        let stakeSum = 0n;
        let delegationSum = 0n;
        const providerStakes: Record<string, ProviderStakeInfo> = {};

        stakesRes.forEach((stake) => {
            if (stake.provider !== null && !IsMeaningfulText(stake.provider)) return;

            stakeSum += BigInt(stake.stake || 0n);
            delegationSum += BigInt(stake.delegateTotal || 0n);

            providerStakes[stake.provider!] = {
                stake: BigInt(stake.stake || 0n).toString(),
                delegateTotal: BigInt(stake.delegateTotal || 0n).toString()
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