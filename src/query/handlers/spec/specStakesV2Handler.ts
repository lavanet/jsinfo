// src/query/handlers/specStakesV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateSpecIdFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { logger } from '@jsinfo/utils/logger';
import { ProviderStakesAndDelegationService } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';
import { JSONStringify } from '@jsinfo/utils/fmt';
// Use the V2 name directly
export const SpecStakesV2HandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
};

export async function SpecStakesV2Handler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const spec = await GetAndValidateSpecIdFromRequest(request, reply);

        if (spec === '') {
            logger.warn(`SpecStakesV2Handler: Empty spec ID provided`);
            reply.header('Content-Type', 'application/json');
            reply.send(JSONStringify({ error: "Empty spec ID" }));
            return reply;
        }

        logger.info(`SpecStakesV2Handler: Processing request for spec=${spec}`);

        // Use the singleton service
        const allStakesData = await ProviderStakesAndDelegationService.fetch();

        // Add detailed logs to help diagnose issues
        if (!allStakesData) {
            logger.error(`SpecStakesV2Handler: No data returned from ProviderStakesAndDelegationService for spec=${spec}`);
            reply.header('Content-Type', 'application/json');
            reply.status(400).send(JSONStringify({ error: 'No stakes data available' }));
            return reply;
        }

        if (!allStakesData.detailedSpecStakes) {
            logger.error(`SpecStakesV2Handler: detailedSpecStakes missing in resource for spec=${spec}`);
            reply.header('Content-Type', 'application/json');
            reply.status(400).send(JSONStringify({ error: 'Detailed spec stakes data not available' }));
            return reply;
        }

        // Get stakes for this spec
        const specStakes = allStakesData.detailedSpecStakes[spec] || [];

        // Log the data presence
        if (specStakes.length === 0) {
            logger.warn(`SpecStakesV2Handler: No stakes found for spec=${spec}`);

            // Log available specs to help diagnose
            const availableSpecs = Object.keys(allStakesData.detailedSpecStakes);
            logger.info(`SpecStakesV2Handler: Available specs: ${availableSpecs.join(', ')}`);

            reply.header('Content-Type', 'application/json');
            reply.send(JSONStringify({
                data: [],
                summary: allStakesData.summary
            }));
            return reply;
        }

        // Be explicit about everything
        reply.header('Content-Type', 'application/json');
        reply.code(200);
        reply.send(JSONStringify(specStakes));

        logger.info('SpecStakesV2Handler: Response sent');
        return reply;
    } catch (error) {
        logger.error(`Error in SpecStakesV2Handler: ${error}`);
        reply.header('Content-Type', 'application/json');
        reply.status(400).send(JSONStringify({
            error: 'server error',
            details: error instanceof Error ? error.message : String(error)
        }));
        return reply;
    }
}
