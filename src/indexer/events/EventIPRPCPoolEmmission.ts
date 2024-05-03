import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { SetTx } from "../setLatest";
import { EventProcessAttributes } from "../eventUtils";

/* 
1500436	1000	 	1138596	{"type":"lava_iprpc-pool-emmission","iprpc_rewards_leftovers":"9ulava"}
*/

export const ParseIPRPCPoolEmission = (
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
    eventType: JsinfoSchema.LavaProviderEventType.IPRPCPoolEmission,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseIPRPCPoolEmission",
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

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(dbEvent)
}
