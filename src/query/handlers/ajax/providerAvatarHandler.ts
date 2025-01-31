// src/query/handlers/ajax/providerAvatarHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { GetProviderAvatar, GetAllProviderAvatars } from '@jsinfo/restRpc/GetProviderAvatar';
import { JSONStringify } from '@jsinfo/utils/fmt';
import { logger } from '@jsinfo/utils/logger';

// Schema for single avatar request
export const GetProviderAvatarHandlerOpts: RouteShorthandOptions = {
    schema: {
        params: {
            type: 'object',
            required: ['providerId'],
            properties: {
                providerId: {
                    type: 'string',
                    pattern: '^lava@[a-zA-Z0-9]+$' // Basic Lava address validation
                }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    avatar_url: { type: ['string', 'null'] }
                }
            }
        }
    }
};

// Schema for listing all avatars
export const ListProviderAvatarsHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                additionalProperties: { type: 'string' }
            }
        }
    }
};

export interface ProviderAvatarParams {
    Params: {
        providerId: string;
    };
}

// Get single provider avatar
export async function GetProviderAvatarHandler(
    request: FastifyRequest<ProviderAvatarParams>,
    reply: FastifyReply
) {
    try {
        const { providerId } = request.params;
        const avatarUrl = await GetProviderAvatar(providerId);

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify({ avatar_url: avatarUrl }));
    } catch (error) {
        logger.error('Error in GetProviderAvatarHandler:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}

// List all provider avatars
export async function ListProviderAvatarsHandler(
    request: FastifyRequest,
    reply: FastifyReply
) {
    try {
        const avatarMap = await GetAllProviderAvatars();
        const avatarObject = Object.fromEntries(avatarMap);

        reply.header('Content-Type', 'application/json');
        return reply.send(JSONStringify(avatarObject));
    } catch (error) {
        logger.error('Error in ListProviderAvatarsHandler:', error);
        return reply.status(500).send({ error: 'Internal server error' });
    }
}
