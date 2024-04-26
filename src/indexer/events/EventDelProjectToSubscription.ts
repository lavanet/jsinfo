import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";
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
  const evtEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.DelProjectToSubscription,
    provider: null,
  }

  if (!EventProcessAttributes(lavaBlock, "ParseEventDelProjectToSubscription", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'subscription':
          evtEvent.consumer = EventParseProviderAddress(value);
          break
        case 'projectName':
          evtEvent.t1 = value;
          break
      }
    },
    verifyFunction: () => !evtEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbEvents.push(evtEvent)
}