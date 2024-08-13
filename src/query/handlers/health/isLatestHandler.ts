// src/query/handlers/isLatestRawHandler.ts

// curl http://localhost:8081/islatest

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, GetLatestBlock } from '../../queryDb';
import { WriteErrorToFastifyReply } from '../../utils/queryServerUtils';

export const IsLatestRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    height: { type: 'number' },
                    datetime: { type: 'number' },
                },
                required: ['height', 'datetime']
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                },
                required: ['error']
            }
        }
    }
}

export async function IsLatestRawHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        await QueryCheckJsinfoReadDbInstance();

        const { latestHeight, latestDatetime } = await GetLatestBlock();
        const currentUtcTime = new Date().getTime();

        // Check if the latestDatetime is more than one hour away from the current UTC time
        if (Math.abs(currentUtcTime - latestDatetime) > 900000) { // 900000 milliseconds = 15 minutes
            console.error("The latest block's datetime is more than one hour away from the current time.");
            WriteErrorToFastifyReply(reply, "The latest block's datetime is more than one hour away from the current time.");
            return null;
        }

        return reply.send({
            status: "ok",
            height: latestHeight,
            datetime: latestDatetime,
        });
    } catch (error) {
        console.error("Error occurred while checking if the latest block is up-to-date:", error);
        WriteErrorToFastifyReply(reply, "Error occurred while checking if the latest block is up-to-date.");
        return null;
    }
}