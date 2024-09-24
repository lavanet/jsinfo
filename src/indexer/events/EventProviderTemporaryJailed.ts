import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt, EventParseBigInt } from "../eventUtils";

/*
1601040 lava_provider_temporary_jailed {
  type: "lava_provider_temporary_jailed",
  attributes: [
    {
      key: "chain_id",
      value: "EVMOS",
    }, {
      key: "complaint_cu",
      value: "11832",
    }, {
      key: "duration",
      value: "3.6µs",
    }, {
      key: "end",
      value: "1721804665",
    }, {
      key: "provider_address",
      value: "lava@1raxe5w7mqs5j5h8ykz87ek4xwuzc4qarm82xms",
    },
    {
      key: "serviced_cu",
      value: "950",
    }
  ],
}
*/

export const ParseEventProviderTemporaryJailed = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.ProviderTemporaryJailed,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventProviderTemporaryJailed",
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
        case 'duration':
          dbEvent.t1 = value;
          break
        case 'end':
          dbEvent.r2 = EventParseInt(value)
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;


  GetOrSetProvider(lavaBlock.dbProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}