import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";

import { EventProcessAttributes } from "../eventUtils";

/* 
1500436	1000	 	1138596	
{"type":"lava_iprpc-pool-emmission","iprpc_rewards_leftovers":"9ulava"}
*/

export const ParseEventIPRPCPoolEmission = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.IPRPCPoolEmission,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventIPRPCPoolEmission",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'iprpc_rewards_leftovers':
          dbEvent.t1 = value;
          break;
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;


  lavaBlock.dbEvents.push(dbEvent)
}
