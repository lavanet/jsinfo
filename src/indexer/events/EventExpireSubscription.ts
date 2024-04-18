import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
https://github.com/lavanet/lava/blob/976bbd1063c66742b2f49465d39fe57ef6edff8a/x/subscription/keeper/subscription.go#L694

  details := map[string]string{"consumer": consumer}
  utils.LogLavaEvent(ctx, k.Logger(ctx), types.ExpireSubscriptionEventName, details, "subscription expired")
*/

/*
LavaBlockDebugDumpEvents event 1062747 lava_expire_subscription_event {
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
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {

  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.ExpireSubscription,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes("ParseEventExpireSubscrption", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'consumer':
          evtEvent.consumer = EventParseProviderAddress(value);
          break;
      }
    },
    verifyFunction: () => !!evtEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbEvents.push(evtEvent)
}