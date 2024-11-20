import { IsMeaningfulText } from "@jsinfo/utils/fmt";
import { logger } from "@jsinfo/utils/logger";
import { StringifyJsonForCompare } from "@jsinfo/utils/fmt";
import { QueryLavaRPC } from "@jsinfo/indexer/utils/restRpc";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { eq, desc } from "drizzle-orm";
import { queryJsinfo } from '@jsinfo/utils/dbPool';
import { MemoryCache } from "@jsinfo/indexer/classes/MemoryCache";

interface Credit {
    denom: string;
    amount: string;
}

interface SubInfo {
    consumer: string;
    plan: string;
    duration_bought: string;
    duration_left: string;
    month_expiry: string;
    month_cu_total: string;
    month_cu_left: string;
    cluster: string;
    duration_total: string;
    auto_renewal_next_plan: string;
    future_subscription: any | null;
    credit: Credit;
}

interface SubscriptionListResponse {
    subs_info: SubInfo[];
}

export async function GetSubscriptionList(): Promise<SubscriptionListResponse> {
    return QueryLavaRPC<SubscriptionListResponse>("/lavanet/lava/subscription/list");
}

export async function ProcessSubscriptionList(): Promise<void> {
    try {
        const subscriptionList = await GetSubscriptionList();

        for (const sub of subscriptionList.subs_info) {
            await ProcessSubscription(sub);
        }
    } catch (error) {
        logger.error('Error processing subscription list', { error });
        throw error;
    }
}

async function ProcessSubscription(sub: SubInfo): Promise<void> {
    const { consumer, plan } = sub;

    if (!IsMeaningfulText(consumer) || !IsMeaningfulText(plan)) {
        return;
    }

    const cacheKey = `subscription-${consumer}-${plan}`;
    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.processed) {
        return;
    }

    const dataString = JSON.stringify(sub);

    const existingData = await queryJsinfo(
        async (db) => db.select({ fulltext: JsinfoSchema.consumerSubscriptionList.fulltext })
            .from(JsinfoSchema.consumerSubscriptionList)
            .where(eq(JsinfoSchema.consumerSubscriptionList.consumer, consumer))
            .orderBy(desc(JsinfoSchema.consumerSubscriptionList.createdAt))
            .limit(1),
        'ProcessSubscription_select'
    );

    const existingFulltext = existingData[0]?.fulltext || '';

    if (existingFulltext === '' || StringifyJsonForCompare(existingFulltext) !== StringifyJsonForCompare(dataString)) {
        const newSubscription: JsinfoSchema.InsertConsumerSubscriptionList = {
            consumer,
            plan,
            fulltext: dataString,
        };

        await queryJsinfo(
            async (db) => db.insert(JsinfoSchema.consumerSubscriptionList).values(newSubscription),
            'ProcessSubscription_insert'
        );
        logger.info('New subscription record inserted');
    }

    await MemoryCache.setDict(cacheKey, { processed: true }, 3600);
}


