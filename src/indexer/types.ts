import * as schema from '../schema';

export type LavaBlock = {
    height: number
    datetime: number,

    dbProviders: Map<string, schema.Provider>
    dbSpecs: Map<string, schema.Spec>
    dbConsumers: Map<string, schema.Consumer>
    dbPlans: Map<string, schema.Plan>
    dbTxs: Map<string, schema.Tx>
    dbEvents: schema.InsertEvent[]
    dbPayments: schema.InsertRelayPayment[]
    dbConflictResponses: schema.InsertConflictResponse[]
    dbSubscriptionBuys: schema.InsertSubscriptionBuy[]
    dbConflictVote: schema.InsertConflictVote[]
    dbProviderReports: schema.InsertProviderReported[]
}