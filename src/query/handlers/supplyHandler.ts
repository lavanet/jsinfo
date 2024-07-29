// src/query/handlers/supplyHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';

export const SupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'number'
            }
        }
    }
}

export async function TotalSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const supplydb = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.supply);

    const supplyData = supplydb.reduce((acc, row) => {
        acc.set(row.key, {
            amount: row.amount.toString(),
            timestamp: row.timestamp.toISOString(),
        });
        return acc;
    }, new Map());

    const getSupplyData = (key) => {
        const data = supplyData.get(key);
        if (data) {
            data.denom = "ulava";
            return data;
        }
        return { amount: "-", timestamp: "-", denom: "-" };
    };

    return getSupplyData("total").amount / 1000000;
}


export async function CirculatingSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const supplydb = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.supply);

    const supplyData = supplydb.reduce((acc, row) => {
        acc.set(row.key, {
            amount: row.amount.toString(),
            timestamp: row.timestamp.toISOString(),
        });
        return acc;
    }, new Map());

    const getSupplyData = (key) => {
        const data = supplyData.get(key);
        if (data) {
            data.denom = "ulava";
            return data;
        }
        return { amount: "-", timestamp: "-", denom: "-" };
    };

    return getSupplyData("circulating").amount / 1000000;
}