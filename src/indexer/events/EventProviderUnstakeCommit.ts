import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { GetOrSetProvider, SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt, EventParseBigInt } from "../eventUtils";

/*

no good examples recently
EventDebug txs event 1050816 lava_provider_unstake_commit {
  type: "lava_provider_unstake_commit",
  attributes: [
    {
      key: "address",
      value: "",
    }, {
      key: "chainID",
      value: "",
    }, {
      key: "geolocation",
      value: "0",
    }, {
      key: "moniker",
      value: "",
    }, {
      key: "stake",
      value: "<nil>",
    }
  ],
}

EventDebug txs event 1009118 lava_provider_unstake_commit {
  type: "lava_provider_unstake_commit",
  attributes: [
    {
      key: "address",
      value: "lava@1l0gcpxw6zrhsxjv68rzvscvcx4p9f07y7974r5",
    }, {
      key: "chainID",
      value: "FTM250",
    }, {
      key: "geolocation",
      value: "1",
    }, {
      key: "moniker",
      value: "stg-lava-1-provider1-FTM250",
    }, {
      key: "stake",
      value: "0",
    }
  ],
}

462618 {
  type: 'lava_provider_unstake_commit',
  attributes: [
    { key: 'stake', value: '50000000000' },
    {
      key: 'address',
      value: 'lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f'
    },
    { key: 'chainID', value: 'COS5' },
    { key: 'geolocation', value: '2' },
    { key: 'moniker', value: 'Iryna' }
  ]
}
*/

export const ParseEventProviderUnstakeCommit = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.ProviderUnstakeCommit,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventProviderUnstakeCommit",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'geolocation':
          dbEvent.i1 = EventParseInt(value)
          break
        case 'moniker':
          dbEvent.t1 = value;
          break
        case 'stake':
          dbEvent.b1 = EventParseBigInt(value)
          break
        case 'address':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'chainID':
          dbEvent.t2 = value;
          break
      }
    },
    verifyFunction: null
  })) return;

  if (!dbEvent.provider) return;


  GetOrSetProvider(lavaBlock.dbProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}