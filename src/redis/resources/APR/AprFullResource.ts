import { RedisResourceBase } from '../../classes/RedisResourceBase';
import { logger } from '@jsinfo/utils/logger';
import { CalculatePercentile, PERCENTILE } from './AprCalcualtor';
import { CalculateProviderAprs } from './AprService';
import { CalculateValidatorAprs } from './AprService';

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
    protected redisKey = 'apr_full_v3';
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

            return {
                percentile: {
                    restaking_apr_percentile: CalculatePercentile(
                        Object.values(filteredProviderAprs).map(d => Number(d.apr_full_num)),
                        PERCENTILE,
                        'Restaking APR'
                    ),
                    staking_apr_percentile: CalculatePercentile(
                        Object.values(filteredValidatorAprs).map(v => Number(v.apr_full_num)),
                        PERCENTILE,
                        'Staking APR'
                    )
                },
                full: {
                    "Staking APR": Object.fromEntries(
                        Object.entries(filteredValidatorAprs).map(([key, value]) => [key, value.apr_full_num])
                    ),
                    "Restaking APR": Object.fromEntries(
                        Object.entries(filteredProviderAprs).map(([key, value]) => [key, value.apr_full_num])
                    )
                }
            };
        } catch (error) {
            logger.error('Error calculating APRs:', error);
            throw error;
        }
    }
}

export const AprFullService = new AprFullResource(); 