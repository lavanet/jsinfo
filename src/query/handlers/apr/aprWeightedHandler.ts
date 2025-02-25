import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@jsinfo/utils/logger';
import { AprWeightedHistoryService } from '@jsinfo/redis/resources/APR/AprWeightedHistoryResource';

export async function GetAprWeightedHistoryHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const histories = await AprWeightedHistoryService.fetch();
        reply.send({
            data: histories
        });
    } catch (error) {
        logger.error('Failed to get APR weighted histories:', error);
        reply.status(500).send({
            error: 'Failed to get APR weighted histories'
        });
    }
}

