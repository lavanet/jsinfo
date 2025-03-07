import { logger } from '@jsinfo/utils/logger';
import { RedisResourceBase } from '@jsinfo/redis/classes/RedisResourceBase';
import { GetMainnetValidatorsWithRewards, ValidatorsWithRewardsResponse } from '@jsinfo/restRpc/Mainnet/MainnetValidatorDataRpc';

export interface MainnetValidatorsWithRewardsResourceResponse {
    data: ValidatorsWithRewardsResponse;
}

class MainnetValidatorsWithRewardsResource extends RedisResourceBase<MainnetValidatorsWithRewardsResourceResponse, {}> {
    protected readonly redisKey = 'mainnet_validators_with_rewards_v2';
    protected readonly cacheExpirySeconds = 7200 * 3; // 6 hours

    protected async fetchFromSource(): Promise<MainnetValidatorsWithRewardsResourceResponse> {
        try {
            const validatorsData = await GetMainnetValidatorsWithRewards();
            return { data: validatorsData };
        } catch (error) {
            logger.error('Error fetching validators with rewards:', error);
            throw error;
        }
    }
}

export const MainnetValidatorsWithRewardsService = new MainnetValidatorsWithRewardsResource(); 