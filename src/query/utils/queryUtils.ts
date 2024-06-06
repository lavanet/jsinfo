// jsinfo/src/query/utils/queryUtils.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from "../queryDb";
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { eq } from "drizzle-orm";

export function CompareValues(aValue: string | number | null, bValue: string | number | null, direction: 'ascending' | 'descending') {
    // Check if direction is 'ascending' or 'descending'
    if (direction !== 'ascending' && direction !== 'descending') {
        throw new Error('Invalid direction. Direction must be either "ascending" or "descending".');
    }

    // Handle null values
    if (aValue === null && bValue === null) {
        return 0;
    } else if (aValue === null) {
        return direction === 'ascending' ? -1 : 1;
    } else if (bValue === null) {
        return direction === 'ascending' ? 1 : -1;
    }

    // Convert to number if both values are numeric
    if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
        aValue = Number(aValue);
        bValue = Number(bValue);
    }

    if (direction === 'ascending') {
        return aValue > bValue ? 1 : -1;
    } else {
        return aValue < bValue ? 1 : -1;
    }
}

export const IsNotNullAndNotZero = (value: number | null) => value !== null && value !== 0;

export function CSVEscape(str: string): string {
    return `"${str.replace(/"/g, '""')}"`;
}

let GetAndValidateProviderAddressFromRequest_cache = {};

export async function GetAndValidateProviderAddressFromRequest(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { addr } = request.params as { addr: string };
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        reply.code(400).send({ error: 'Bad provider address' });
        return '';
    }

    let res = GetAndValidateProviderAddressFromRequest_cache[addr];
    if (res) {
        return addr;
    }

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1);

    if (res.length != 1) {
        reply.code(400).send({ error: 'Provider does not exist' });
        return '';
    }

    GetAndValidateProviderAddressFromRequest_cache[addr] = true;

    return addr;
}

let GetAndValidateSpecIdFromRequest_cache = {};

export async function GetAndValidateSpecIdFromRequest(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { specId } = request.params as { specId: string };
    if (specId.length <= 0) {
        reply.code(400).send({ error: 'invalid specId' });
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
        reply.code(400).send({ error: 'specId does not exist' });
        return '';
    }

    GetAndValidateSpecIdFromRequest_cache[upSpecId] = true;

    return upSpecId;
}

export function GetNestedValue(obj: any, keyPath: string): string | number | null {
    const keys = keyPath.split('.');
    let value = obj;

    for (let key of keys) {
        if (value && value[key] !== undefined) {
            value = value[key];
        } else {
            return null;
        }
    }

    return value;
}

export function GetDataLengthForPrints(data: any): string {
    if (data == null) return '<null>';
    if (Array.isArray(data)) {
        return String(data.length);
    } else if (typeof data === 'object' && data !== null) {
        return String(Object.keys(data).length);
    }
    return 'N/A';
}

export function GetDataLength(data: any): number {
    if (data == null) return 0;
    if (Array.isArray(data)) {
        return data.length;
    } else if (typeof data === 'object' && data !== null) {
        return Object.keys(data).length;
    }
    return 0;
}