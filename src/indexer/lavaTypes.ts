// src/indexer/types.ts

import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import * as lavajs from '@lavanet/lavajs';

export type LavaClient = Awaited<ReturnType<typeof lavajs.lavanet.ClientFactory.createRPCQueryClient>>

export type LavaBlock = {
    height: number
    datetime: number,

    dbEvents: JsinfoSchema.InsertEvent[]
    dbPayments: JsinfoSchema.InsertRelayPayment[]
    dbConflictResponses: JsinfoSchema.InsertConflictResponse[]
    dbSubscriptionBuys: JsinfoSchema.InsertSubscriptionBuy[]
    dbConflictVote: JsinfoSchema.InsertConflictVote[]
    dbProviderReports: JsinfoSchema.InsertProviderReported[]
    dbProviderLatestBlockReports: JsinfoSchema.InsertProviderLatestBlockReports[]
}