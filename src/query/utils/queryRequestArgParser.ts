// src/query/utils/queryRequestArgParser.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from "../queryDb";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { WriteErrorToFastifyReply } from "./queryServerUtils";

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

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.consumers).where(eq(JsinfoSchema.consumers.address, addr)).limit(1);

    if (res.length != 1) {
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

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1);

    if (res.length != 1) {
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

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1);

    if (res.length != 1) {
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

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs).where(eq(JsinfoSchema.specs.id, upSpecId)).limit(1);

    if (res.length != 1) {
        WriteErrorToFastifyReply(reply, 'specId does not exist');
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

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.specs).where(eq(JsinfoSchema.specs.id, upSpecId)).limit(1);

    if (res.length != 1) {
        WriteErrorToFastifyReply(reply, 'specId does not exist');
        return '';
    }

    GetAndValidateSpecIdFromRequest_cache[upSpecId] = true;

    return upSpecId;
}