import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { GetOrSetConsumer, SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
371879  {
  type: 'lava_del_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: '07042678b43520acb7e2c2e50d18a89e' }
  ]
}
*/

export const ParseEventDelProjectToSubscription = (
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
    eventType: JsinfoSchema.LavaProviderEventType.DelProjectToSubscription,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventDelProjectToSubscription",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'subscription':
          dbEvent.consumer = EventParseProviderAddress(value);
          break
        case 'projectName':
          dbEvent.t1 = value;
          break
      }
    },
    verifyFunction: () => !dbEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, dbEvent.consumer!)
  lavaBlock.dbEvents.push(dbEvent)
}