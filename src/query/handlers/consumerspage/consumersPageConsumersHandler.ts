// src/query/handlers/consumersPageConsumersHandler.ts

// curl http://localhost:8081/consumerspageConsumers | jq

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoDbInstance, QueryGetJsinfoDbForQueryInstance } from '../../queryDb';
import { asc, gte, max } from "drizzle-orm";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import * as JsinfoConsumerAgrSchema from '@jsinfo/schemas/jsinfoSchema/consumerRelayPaymentsAgregation';

export const ConsumersPageConsumersRawHandlerOpts = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                consumer: { type: 'string' },
                                plan: { type: ['string', 'null'] },
                                cuSum: { type: ['number', 'null'] },
                                relaySum: { type: ['number', 'null'] },
                                rewardSum: { type: ['number', 'null'] },
                                qosSyncAvg: { type: ['number', 'null'] },
                                qosSyncExcAvg: { type: ['number', 'null'] }
                            },
                            required: ['consumer', 'plan']
                        }
                    }
                }
            }
        }
    }
}

type ConsumerEntry = {
    consumer: string;
    plan: string | null;
};
async function fetchConsumerEntries(): Promise<ConsumerEntry[]> {
    await QueryCheckJsinfoDbInstance();

    let ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let reportsRes = await QueryGetJsinfoDbForQueryInstance()
        .select({
            consumer: JsinfoSchema.consumerSubscriptionList.consumer,
            plan: JsinfoSchema.consumerSubscriptionList.plan,
            earliestCreatedAt: max(JsinfoSchema.consumerSubscriptionList.createdAt)
        })
        .from(JsinfoSchema.consumerSubscriptionList)
        .where(
            gte(JsinfoSchema.consumerSubscriptionList.createdAt, ninetyDaysAgo)
        )
        .groupBy(JsinfoSchema.consumerSubscriptionList.consumer, JsinfoSchema.consumerSubscriptionList.plan)
        .orderBy(asc(max(JsinfoSchema.consumerSubscriptionList.createdAt)))
        .limit(500);

    return reportsRes;
}

type ConsumerAgrEntry = {
    consumer: string | null;
    cuSum: number | null;
    relaySum: number | null;
    rewardSum: number | null;
    qosSyncAvg: number | null;
    qosSyncExcAvg: number | null;
}

async function fetchConsumerAgrResultsEntries(): Promise<ConsumerAgrEntry[]> {
    return await QueryGetJsinfoDbForQueryInstance().select({
        consumer: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.consumer,
        cuSum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.cuSum,
        relaySum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.relaySum,
        rewardSum: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.rewardSum,
        qosSyncAvg: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.qosSyncAvg,
        qosSyncExcAvg: JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments.qosSyncExcAvg
    }).from(JsinfoConsumerAgrSchema.aggConsumerAllTimeRelayPayments);
}

type CombinedConsumerEntry = {
    consumer: string;
    plan: string | null;
    cuSum: number | null;
    relaySum: number | null;
    rewardSum: number | null;
    qosSyncAvg: number | null;
    qosSyncExcAvg: number | null;
};

export async function ConsumersPageConsumersRawHandler(request: FastifyRequest, reply: FastifyReply) {
    const consumerEntries: ConsumerEntry[] = await fetchConsumerEntries();
    const consumerAgrEntries: ConsumerAgrEntry[] = await fetchConsumerAgrResultsEntries();

    const consumerAgrEntriesMap = new Map(consumerAgrEntries.map(entry => [entry.consumer, entry]));

    const mergedEntries: CombinedConsumerEntry[] = consumerEntries.map(entry => {
        const agrEntry = consumerAgrEntriesMap.get(entry.consumer);
        return {
            consumer: entry.consumer,
            plan: entry.plan,
            cuSum: agrEntry?.cuSum || null,
            relaySum: agrEntry?.relaySum || null,
            rewardSum: agrEntry?.rewardSum || null,
            qosSyncAvg: agrEntry?.qosSyncAvg || null,
            qosSyncExcAvg: agrEntry?.qosSyncExcAvg || null,
        };
    });

    return { data: mergedEntries };
}
