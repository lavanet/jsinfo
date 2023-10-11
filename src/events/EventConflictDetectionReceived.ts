import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetTx } from "../setlatest";

/*
340881 {
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
  txHash: string,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.ConflictDetectionReceived,
    provider: null,
  }

  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'client':
        evtEvent.consumer = attr.value;
        break
    }
  })

  GetOrSetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
  lavaBlock.dbEvents.push(evtEvent)
}