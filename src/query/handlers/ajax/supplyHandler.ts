// src/query/handlers/supplyHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { eq } from 'drizzle-orm';

export const SupplyRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
}

export async function TotalSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()

    const result = await QueryGetJsinfoDbForQueryInstance()
        .select({ amount: JsinfoSchema.supply.amount })
        .from(JsinfoSchema.supply)
        .where(eq(JsinfoSchema.supply.key, "total"))

    if (result.length > 0 && result[0].amount) {
        const amount = BigInt(result[0].amount) / BigInt(1000000);
        return amount.toString();
    } else {
        return "0";
    }
}


export async function CirculatingSupplyRawHandler(request: FastifyRequest, reply: FastifyReply) {
    await QueryCheckJsinfoDbInstance()
    // const supplydb = await QueryGetJsinfoDbForQueryInstance().select().from(JsinfoSchema.supply);

    const result = await QueryGetJsinfoDbForQueryInstance()
        .select({ amount: JsinfoSchema.supply.amount })
        .from(JsinfoSchema.supply)
        .where(eq(JsinfoSchema.supply.key, "circulating"))

    if (result.length > 0 && result[0].amount) {
        const amount = BigInt(result[0].amount) / BigInt(1000000);
        return amount.toString();
    } else {
        return "0";
    }
}

