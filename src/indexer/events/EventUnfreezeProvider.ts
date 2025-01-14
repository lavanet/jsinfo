import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
459042 {
  type: 'lava_unfreeze_provider',
  attributes: [
    {
      key: 'providerAddress',
      value: 'lava@13mmqeu332calsmzwzcvhjedx4mdmywurydmrd4'
    },
    {
      key: 'chainIDs',
      value: 'EVMOS,EVMOST,CANTO,JUN1,AXELAR,AXELART'
    }
  ]
}
*/

export const ParseEventUnfreezeProvider = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.UnfreezeProvider,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventUnfreezeProvider",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'providerAddress':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainIDs':
          dbEvent.t1 = value;
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;




  lavaBlock.dbEvents.push(dbEvent)
}