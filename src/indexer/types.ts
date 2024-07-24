// src/indexer/types.ts

import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import * as lavajs from '@lavanet/lavajs';

export type LavaClient = Awaited<ReturnType<typeof lavajs.lavanet.ClientFactory.createRPCQueryClient>>

export type LavaBlock = {
    height: number
    datetime: number,

    dbProviders: Map<string, JsinfoSchema.Provider>
    dbSpecs: Map<string, JsinfoSchema.Spec>
    dbConsumers: Map<string, JsinfoSchema.Consumer>
    dbPlans: Map<string, JsinfoSchema.Plan>
    dbTxs: Map<string, JsinfoSchema.Tx>
    dbEvents: JsinfoSchema.InsertEvent[]
    dbPayments: JsinfoSchema.InsertRelayPayment[]
    dbConflictResponses: JsinfoSchema.InsertConflictResponse[]
    dbSubscriptionBuys: JsinfoSchema.InsertSubscriptionBuy[]
    dbConflictVote: JsinfoSchema.InsertConflictVote[]
    dbProviderReports: JsinfoSchema.InsertProviderReported[]
    dbProviderLatestBlockReports: JsinfoSchema.InsertProviderLatestBlockReports[]
}