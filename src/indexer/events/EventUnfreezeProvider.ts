import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
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
  const evtEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.UnfreezeProvider,
    consumer: null,
  }

  if (!EventProcessAttributes("ParseEventUnfreezeProvider", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'providerAddress':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainIDs':
          evtEvent.t1 = value;
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;


  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}