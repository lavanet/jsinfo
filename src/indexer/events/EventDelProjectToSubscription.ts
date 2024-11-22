import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
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
  lavaBlock: LavaBlock
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



  lavaBlock.dbEvents.push(dbEvent)
}