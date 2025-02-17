// src/query/utils/queryRequestArgParser.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { WriteErrorToFastifyReply } from "./queryServerUtils";
import { ProviderMonikerService } from '@jsinfo/redis/resources/global/ProviderMonikerSpecResource';
import { SpecAndConsumerService } from '@jsinfo/redis/resources/global/SpecAndConsumerResource';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { logger } from '@jsinfo/utils/logger';

let GetAndValidateConsumerAddressFromRequest_cache = {};

export async function GetAndValidateConsumerAddressFromRequest(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { addr } = request.params as { addr: string };
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        WriteErrorToFastifyReply(reply, 'Bad consumer address');
        return '';
    }

    let res = GetAndValidateConsumerAddressFromRequest_cache[addr];
    if (res) {
        return addr;
    }

    if (!(await SpecAndConsumerService.IsValidConsumer(addr))) {
        WriteErrorToFastifyReply(reply, 'Consumer does not exist');
        return '';
    }

    GetAndValidateConsumerAddressFromRequest_cache[addr] = true;

    return addr;
}

let GetAndValidateProviderAddressFromRequest_cache = {};

export async function GetAndValidateProviderAddressFromRequest(endpoint: string, request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { addr } = request.params as { addr: string };
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        WriteErrorToFastifyReply(reply, 'Bad provider address on ' + endpoint);
        return '';
    }

    let res = GetAndValidateProviderAddressFromRequest_cache[addr];
    if (res) {
        return addr;
    }

    if (!(await ProviderMonikerService.IsValidProvider(addr))) {
        WriteErrorToFastifyReply(reply, 'Provider does not exist on ' + endpoint);
        return '';
    }

    GetAndValidateProviderAddressFromRequest_cache[addr] = true;

    return addr;
}

export async function GetAndValidateProviderAddressFromRequestWithAll(endpoint: string, request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { addr } = request.params as { addr: string };

    if (addr.toLowerCase() === 'all') {
        return 'all';
    }

    if (addr.length != 44 || !addr.startsWith('lava@')) {
        WriteErrorToFastifyReply(reply, 'Bad provider address on ' + endpoint);
        return '';
    }

    let res = GetAndValidateProviderAddressFromRequest_cache[addr];
    if (res) {
        return addr;
    }

    if (!(await ProviderMonikerService.IsValidProvider(addr))) {
        WriteErrorToFastifyReply(reply, 'Provider does not exist on ' + endpoint);
        return '';
    }

    GetAndValidateProviderAddressFromRequest_cache[addr] = true;

    return addr;
}

let GetAndValidateSpecIdFromRequest_cache = {};

export async function GetAndValidateSpecIdFromRequest(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { specId } = request.params as { specId: string };
    if (specId.length <= 0) {
        WriteErrorToFastifyReply(reply, 'invalid specId');
        return '';
    }

    const upSpecId = specId.toUpperCase();

    let res = GetAndValidateSpecIdFromRequest_cache[upSpecId];
    if (res) {
        return upSpecId;
    }

    if (!(await SpecAndConsumerService.IsValidSpec(upSpecId))) {
        WriteErrorToFastifyReply(reply, 'Spec does not exist');
        return '';
    }

    GetAndValidateSpecIdFromRequest_cache[upSpecId] = true;

    return upSpecId;
}

export async function GetAndValidateSpecIdFromRequestWithAll(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { specId } = request.params as { specId: string };

    if (specId.toLowerCase() === 'all') {
        return 'all';
    }

    if (specId.length <= 0) {
        WriteErrorToFastifyReply(reply, 'invalid specId');
        return '';
    }

    const upSpecId = specId.toUpperCase();

    let res = GetAndValidateSpecIdFromRequest_cache[upSpecId];
    if (res) {
        return upSpecId;
    }

    if (!(await SpecAndConsumerService.IsValidSpec(upSpecId))) {
        WriteErrorToFastifyReply(reply, 'Spec does not exist');
        return '';
    }

    GetAndValidateSpecIdFromRequest_cache[upSpecId] = true;

    return upSpecId;
}

export function GetDateRangeFromRequest(request: FastifyRequest): { from: Date | undefined; to: Date | undefined } {
    // Support both f/t and from/to parameters
    const { f, t, from: fromAlt, to: toAlt } = request.query as any;
    const fromStr = f || fromAlt;
    const toStr = t || toAlt;

    try {
        const from = fromStr ? new Date(fromStr) : undefined;
        const to = toStr ? new Date(toStr) : undefined;

        // Validate dates are valid
        if (from && isNaN(from.getTime())) {
            logger.warn('Invalid from date', { from: fromStr });
            return { from: undefined, to: undefined };
        }
        if (to && isNaN(to.getTime())) {
            logger.warn('Invalid to date', { to: toStr });
            return { from: undefined, to: undefined };
        }

        // Add logging to debug date parsing
        if (from || to) {
            logger.debug('Parsed dates', {
                fromStr,
                toStr,
                parsedFrom: from?.toISOString(),
                parsedTo: to?.toISOString()
            });
        }

        return { from, to };
    } catch (error) {
        logger.warn('Invalid date format in request', {
            f,
            t,
            fromAlt,
            toAlt,
            error
        });
        return { from: undefined, to: undefined };
    }
}