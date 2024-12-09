import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventProcessAttributes, EventParseProviderAddress, EventParseBigInt } from "../eventUtils";

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
  lavaBlock: LavaBlock
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.ProviderJailed,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventProviderJailed",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'chain_id':
          dbEvent.t1 = value;
          break
        case 'complaint_cu':
          dbEvent.b1 = EventParseBigInt(value)
          break
        case 'provider_address':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'serviced_cu':
          dbEvent.b2 = EventParseBigInt(value)
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;



  lavaBlock.dbEvents.push(dbEvent)
}