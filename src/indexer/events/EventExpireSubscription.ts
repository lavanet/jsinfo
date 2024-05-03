import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
https://github.com/lavanet/lava/blob/976bbd1063c66742b2f49465d39fe57ef6edff8a/x/subscription/keeper/subscription.go#L694

  details := map[string]string{"consumer": consumer}
  utils.LogLavaEvent(ctx, k.Logger(ctx), types.ExpireSubscriptionEventName, details, "subscription expired")
*/

/*
EventDebug event 1062747 lava_expire_subscription_event {
  type: "lava_expire_subscription_event",
  attributes: [
    {
      key: "consumer",
      value: "lava@1qwaszenhu2jmmd2frr8g0e4kj5q54cp2l6nrfn",
    }
  ],
}
*/

export const ParseEventExpireSubscrption = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.ExpireSubscription,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventExpireSubscrption",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'consumer':
          dbEvent.consumer = EventParseProviderAddress(value);
          break;
      }
    },
    verifyFunction: () => !!dbEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, dbEvent.consumer!)
  lavaBlock.dbEvents.push(dbEvent)
}