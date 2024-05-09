import * as JsinfoSchema from '../schemas/jsinfoSchema';

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