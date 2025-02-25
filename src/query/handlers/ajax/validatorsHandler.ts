import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetLatestBlock } from '../../utils/getLatestBlock';
import { RpcPeriodicEndpointCache } from '@jsinfo/restRpc/LavaRpcPeriodicEndpointCache';

export const ValidatorsPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    height: { type: 'number' },
                    datetime: { type: 'number' },
                    validators: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                address: { type: 'string' },
                                moniker: { type: 'string' },
                                jailed: { type: 'boolean' },
                                tokens: { type: 'string' },
                                status: { type: 'string' },
                                commission: {
                                    type: 'object',
                                    properties: {
                                        commission_rates: {
                                            type: 'object',
                                            properties: {
                                                rate: { type: 'string' },
                                                max_rate: { type: 'string' },
                                                max_change_rate: { type: 'string' }
                                            }
                                        },
                                        update_time: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

export async function ValidatorsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    const { latestHeight, latestDatetime } = await GetLatestBlock();
    const validators = await RpcPeriodicEndpointCache.GetAllValidators();

    const validatorInfo = validators.map(validator => ({
        address: validator.operator_address,
        moniker: validator.description.moniker,
        jailed: validator.jailed,
        tokens: validator.tokens,
        status: validator.status,
        commission: {
            commission_rates: {
                rate: Number(validator.commission.commission_rates.rate).toString(),
                max_rate: Number(validator.commission.commission_rates.max_rate).toString(),
                max_change_rate: Number(validator.commission.commission_rates.max_change_rate).toString()
            },
            update_time: validator.commission.update_time
        }
    }));

    return {
        height: latestHeight,
        datetime: latestDatetime,
        validators: validatorInfo
    };
}

export const ActiveValidatorsPaginatedHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    validators: { type: 'array' },
                }
            }
        }
    }
}

export async function ActiveValidatorsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    const validators = await RpcPeriodicEndpointCache.GetAllActiveValidatorsAddresses();
    return {
        validators: validators,
    }
}