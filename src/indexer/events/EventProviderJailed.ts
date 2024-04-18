import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
485100 {
  type: 'lava_provider_jailed',
  attributes: [
      { key: 'chain_id', value: 'COS3' },
      { key: 'complaint_cu', value: '921' },
      {
      key: 'provider_address',
      value: 'lava@12u7dam8tyedr82ntwe6zz5e34n6vhr3kjlanaf'
      },
      { key: 'serviced_cu', value: '70' }
  ]
}
*/

export const ParseEventProviderJailed = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.ProviderJailed,
    consumer: null,
  }

  if (!EventProcessAttributes("ParseEventProviderJailed", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'chain_id':
          evtEvent.t1 = value;
          break
        case 'complaint_cu':
          evtEvent.b1 = EventParseInt(value)
          break
        case 'provider_address':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'serviced_cu':
          evtEvent.b2 = EventParseInt(value)
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}