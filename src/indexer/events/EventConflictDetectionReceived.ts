import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { GetOrSetConsumer, SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
461834 {
  type: 'lava_conflict_detection_received',
  attributes: [
    {
      key: 'client',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    }
  ]
}
*/

export const ParseEventConflictDetectionReceived = (
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
    eventType: JsinfoSchema.LavaProviderEventType.ConflictDetectionReceived,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventConflictDetectionReceived",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'client':
          dbEvent.consumer = EventParseProviderAddress(value);
          break
      }
    },
    verifyFunction: () => !!dbEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, dbEvent.consumer!)
  lavaBlock.dbEvents.push(dbEvent)
}