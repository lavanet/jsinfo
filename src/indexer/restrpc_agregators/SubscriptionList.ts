import { IsMeaningfulText, logger } from "../../utils/utils";
import { ReplaceForCompare } from "./utils";
import { QueryLavaRPC } from "../rpcUtils";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { eq, desc } from "drizzle-orm";
import { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { MemoryCache } from "../classes/MemoryCache";
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

export async function ProcessSubscriptionList(db: PostgresJsDatabase): Promise<void> {
    try {
        const subscriptionList = await GetSubscriptionList();

        for (const sub of subscriptionList.subs_info) {
            await ProcessSubscription(db, sub);
        }
    } catch (error) {
        logger.error('Error processing subscription list', { error });
        throw error;
    }
}

async function ProcessSubscription(db: PostgresJsDatabase, sub: SubInfo): Promise<void> {
    const { consumer, plan } = sub;

    if (!IsMeaningfulText(consumer) || !IsMeaningfulText(plan)) {
        return;
    }

    const cacheKey = `subscription-${consumer}-${plan}`;
    const cachedValue = await MemoryCache.getDict(cacheKey);
    if (cachedValue && cachedValue.processed) {
        // Skip processing duplicate subscription
        return;
    }

    const dataString = JSON.stringify(sub);
    // logger.info(`Processing subscription: ${dataString.slice(0, 1000)}`);

    // Query for existing subscription data
    const existingData = await db.select({ fulltext: JsinfoSchema.consumerSubscriptionList.fulltext })
        .from(JsinfoSchema.consumerSubscriptionList)
        .where(eq(JsinfoSchema.consumerSubscriptionList.consumer, consumer))
        .orderBy(desc(JsinfoSchema.consumerSubscriptionList.createdAt))
        .limit(1);

    const existingFulltext = existingData[0]?.fulltext || '';

    if (existingFulltext === '' || ReplaceForCompare(existingFulltext) !== ReplaceForCompare(dataString)) {
        const newSubscription: JsinfoSchema.InsertConsumerSubscriptionList = {
            consumer,
            plan,
            fulltext: dataString,
        };

        await db.insert(JsinfoSchema.consumerSubscriptionList).values(newSubscription);
        logger.info('New subscription record inserted');
    }

    // Update the cache after processing
    await MemoryCache.setDict(cacheKey, { processed: true }, 3600);
}


