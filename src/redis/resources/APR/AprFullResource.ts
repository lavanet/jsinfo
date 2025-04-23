import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { logger } from '@jsinfo/utils/logger';
import { CalculatePercentile, PERCENTILE } from './AprCalcualtor';
import { CalculateProviderAprs } from './AprService';
import { CalculateValidatorAprs } from './AprService';

// Maximum APR caps
const MAX_PERCENTILE_APR_CAP = 0.3; // 30% cap for percentile values
const MAX_INDIVIDUAL_APR_CAP = 0.8; // 80% cap for individual APR values

export interface AprData {
    percentile: {
        restaking_apr_percentile: number;
        staking_apr_percentile: number;
    };
    full: {
        "Staking APR": { [key: string]: string };
        "Restaking APR": { [key: string]: string };
    };
}

export class AprFullResource extends RedisResourceBase<AprData, {}> {
    protected redisKey = 'apr_full_v4';
    protected cacheExpirySeconds = 7200; // 2 hours cache

    protected async fetchFromSource(): Promise<AprData> {
        try {
            const [providerAprs, validatorAprs] = await Promise.all([
                CalculateProviderAprs(),
                CalculateValidatorAprs()
            ]);

            const filteredProviderAprs = Object.fromEntries(
                Object.entries(providerAprs).filter(([_, value]) => Number(value.apr_full_num) > 0)
            );

            const filteredValidatorAprs = Object.fromEntries(
                Object.entries(validatorAprs).filter(([_, value]) => Number(value.apr_full_num) > 0)
            );

            // Calculate percentiles and apply caps
            const restakingPercentile = Math.min(
                CalculatePercentile(
                    Object.values(filteredProviderAprs).map(d => Number(d.apr_full_num)),
                    PERCENTILE,
                    'Restaking APR'
                ),
                MAX_PERCENTILE_APR_CAP
            );

            const stakingPercentile = Math.min(
                CalculatePercentile(
                    Object.values(filteredValidatorAprs).map(v => Number(v.apr_full_num)),
                    PERCENTILE,
                    'Staking APR'
                ),
                MAX_PERCENTILE_APR_CAP
            );

            // Apply caps to individual APR values
            const cappedStakingAprs = Object.fromEntries(
                Object.entries(filteredValidatorAprs).map(([key, value]) => {
                    const aprValue = Number(value.apr_full_num);
                    const cappedValue = Math.min(aprValue, MAX_INDIVIDUAL_APR_CAP).toString();
                    return [key, cappedValue];
                })
            );

            const cappedRestakingAprs = Object.fromEntries(
                Object.entries(filteredProviderAprs).map(([key, value]) => {
                    const aprValue = Number(value.apr_full_num);
                    const cappedValue = Math.min(aprValue, MAX_INDIVIDUAL_APR_CAP).toString();
                    return [key, cappedValue];
                })
            );

            return {
                percentile: {
                    restaking_apr_percentile: restakingPercentile,
                    staking_apr_percentile: stakingPercentile
                },
                full: {
                    "Staking APR": cappedStakingAprs,
                    "Restaking APR": cappedRestakingAprs
                }
            };
        } catch (error) {
            logger.error('Error calculating APRs:', error);
            throw error;
        }
    }
}

export const AprFullService = new AprFullResource(); 