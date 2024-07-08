// jsinfo/src/query/utils/queryUtils.ts

import { FastifyReply, FastifyRequest } from "fastify";
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from "../queryDb";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from "drizzle-orm";
import { WriteErrorToFastifyReply } from "./queryServerUtils";
import { parseISO } from 'date-fns';

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

export function CSVEscape(str: string): string {
    return `"${str.replace(/"/g, '""')}"`;
}

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

export async function GetAndValidateProviderAddressFromRequest(request: FastifyRequest, reply: FastifyReply): Promise<string> {
    const { addr } = request.params as { addr: string };
    if (addr.length != 44 || !addr.startsWith('lava@')) {
        WriteErrorToFastifyReply(reply, 'Bad provider address');
        return '';
    }

    let res = GetAndValidateProviderAddressFromRequest_cache[addr];
    if (res) {
        return addr;
    }

    await QueryCheckJsinfoReadDbInstance();

    res = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.providers).where(eq(JsinfoSchema.providers.address, addr)).limit(1);

    if (res.length != 1) {
        WriteErrorToFastifyReply(reply, 'Provider does not exist');
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

export function GetTypeAsString(obj: any): string {
    return Object.prototype.toString.call(obj).replace(/^\[object\s|\]$/g, '');
}

export function ParseDateToUtc(dt: string | number): Date {
    let date: Date;

    if (typeof dt === 'number' || (typeof dt === 'string' && /^\d+$/.test(dt))) {
        // Convert Unix timestamp to milliseconds and create a Date object
        date = new Date(typeof dt === 'string' ? parseInt(dt, 10) * 1000 : dt * 1000);
    } else if (typeof dt === 'string') {
        // Parse ISO string to Date
        date = parseISO(dt);
    } else {
        throw new Error('Unsupported date type');
    }

    // Convert to UTC by creating a new Date object using the UTC values from the original date
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
}