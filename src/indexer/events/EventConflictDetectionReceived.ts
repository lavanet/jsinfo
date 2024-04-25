import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";
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
  const evtEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.ConflictDetectionReceived,
    provider: null,
  }

  if (!EventProcessAttributes("ParseEventConflictDetectionReceived", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'client':
          evtEvent.consumer = EventParseProviderAddress(value);
          break
      }
    },
    verifyFunction: () => !!evtEvent.consumer
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbEvents.push(evtEvent)
}