import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setLatest";
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
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
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


  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}