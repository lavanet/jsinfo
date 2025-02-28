// src/query/handlers/providerStakesV2Handler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetAndValidateProviderAddressFromRequest } from '@jsinfo/query/utils/queryRequestArgParser';
import { CSVEscape, JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';
import { ProviderStakesAndDelegationService } from '@jsinfo/redis/resources/global/ProviderStakesAndDelegationResource';

// Simplified schema with basic type checking
export const ProviderStakesV2HandlerOpts: RouteShorthandOptions = {
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

export const ProviderStakesV2CSVRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'string'
            }
        }
    }
};

// Simplified handler with direct data return - no Redis caching
export async function ProviderStakesV2Handler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const addr = await GetAndValidateProviderAddressFromRequest("providerStakes", request, reply);
        if (addr === '') {
            return null;
        }

        logger.info(`ProviderStakesV2Handler: Processing request for provider=${addr}`);

        // Use the singleton service
        const allStakesData = await ProviderStakesAndDelegationService.fetch();

        if (!allStakesData || !allStakesData.detailedProviderStakes) {
            logger.error(`ProviderStakesV2Handler: Detailed provider stakes data not available for provider=${addr}`);
            reply.status(500).send({ error: 'Detailed provider stakes data not available' });
            return null;
        }

        const providerDetailedStakes = allStakesData.detailedProviderStakes[addr] || [];
        logger.info(`ProviderStakesV2Handler: Found ${providerDetailedStakes.length} stakes for provider=${addr}`);

        // Return with explicit status for clarity
        reply.header('Content-Type', 'application/json');
        reply.status(200).send(JSONStringify({ data: providerDetailedStakes }));
        return reply;
    } catch (error) {
        reply.header('Content-Type', 'application/json');
        logger.error(`Error in ProviderStakesV2Handler: ${error}`);
        reply.status(400).send(JSONStringify({ error: 'server error' }));
        return null;
    }
}

// CSV handler
export async function ProviderStakesV2CSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const addr = await GetAndValidateProviderAddressFromRequest("providerStakes", request, reply);
        if (addr === '') {
            return;
        }

        logger.info(`ProviderStakesV2CSVRawHandler: Processing request for provider=${addr}`);

        // Get data directly instead of calling the handler
        const allStakesData = await ProviderStakesAndDelegationService.fetch();

        if (!allStakesData || !allStakesData.detailedProviderStakes) {
            logger.error(`ProviderStakesV2CSVRawHandler: Detailed provider stakes data not available for provider=${addr}`);
            reply.status(400).send(JSONStringify({ error: 'Failed to fetch stakes data' }));
            return;
        }

        const providerDetailedStakes = allStakesData.detailedProviderStakes[addr] || [];

        if (providerDetailedStakes.length === 0) {
            logger.warn(`ProviderStakesV2CSVRawHandler: No stakes found for provider=${addr}`);
        }

        // Create CSV with comprehensive data
        const columns = [
            { key: "specId", name: "Spec" },
            { key: "chainName", name: "Chain" },
            { key: "statusString", name: "Status" },
            { key: "stake", name: "Self Stake" },
            { key: "delegateTotal", name: "Delegation" },
            { key: "totalStake", name: "Total Stake" },
            { key: "delegateCommission", name: "Commission %" },
            { key: "cuSum30Days", name: "CU (30 Days)" },
            { key: "cuSum90Days", name: "CU (90 Days)" },
            { key: "relaySum30Days", name: "Relays (30 Days)" },
            { key: "relaySum90Days", name: "Relays (90 Days)" },
            { key: "moniker", name: "Moniker" },
            { key: "appliedHeight", name: "Applied Height" },
            { key: "extensions", name: "Extensions" },
            { key: "health.overallStatus", name: "Health Status" },
            { key: "health.lastTimestamp", name: "Last Health Check" },
        ];

        let csv = columns.map(column => CSVEscape(column.name)).join(',') + '\n';

        providerDetailedStakes.forEach((item: any) => {
            csv += columns.map(column => {
                // Handle nested properties like health.overallStatus
                if (column.key.includes('.')) {
                    const [parent, child] = column.key.split('.');
                    return CSVEscape(String(item[parent] && item[parent][child] || ''));
                }
                return CSVEscape(String(item[column.key] || ''));
            }).join(',') + '\n';
        });

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="ProviderStakes_${addr}.csv"`);
        return csv;
    } catch (error) {
        reply.header('Content-Type', 'application/json');
        logger.error(`Error in ProviderStakesV2CSVRawHandler: ${error}`);
        reply.status(400).send(JSONStringify({ error: 'server error' }));
    }
}