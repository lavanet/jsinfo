import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setLatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
EventDebug txs event 1074270 lava_stake_new_provider {
  type: "lava_stake_new_provider",
  attributes: [
    {
      key: "geolocation",
      value: "65535",
    }, {
      key: "moniker",
      value: "TeoViTeoVi",
    }, {
      key: "provider",
      value: "lava@1p7d580vfu5pvu77kmmhzr9shxmqzyr57ktpue9",
    }, {
      key: "spec",
      value: "STRKT",
    }, {
      key: "stake",
      value: "50000000000ulava",
    }, {
      key: "stakeAppliedBlock",
      value: "1074271",
    }
  ],
}

//block 340870
lava_stake_new_provider {
  type: 'lava_stake_new_provider',
  attributes: [
    { key: 'spec', value: 'AVAX' },
    {
      key: 'provider',
      value: 'lava@16slsjlavjlm8ganzrqtqhm8tnzj7w3xqycnhv9'
    },
    { key: 'stakeAppliedBlock', value: '340871' },
    { key: 'stake', value: '50000000000ulava' },
    { key: 'geolocation', value: '2' },
    { key: 'effectiveImmediately', value: 'false' },
    { key: 'moniker', value: 'mahof' }
  ]
}
*/

export const ParseEventStakeNewProvider = (
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
    eventType: JsinfoSchema.LavaProviderEventType.StakeNewProvider,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventStakeNewProvider",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'spec':
          dbEvent.t1 = value;
          break
        case 'provider':
          dbEvent.provider = EventParseProviderAddress(value);
          break
        case 'stakeAppliedBlock':
          dbEvent.i1 = EventParseInt(value)
          break
        case 'stake':
          dbEvent.b1 = EventParseUlava(value)
          break
        case 'geolocation':
          dbEvent.i1 = EventParseInt(value)
          break
        case 'effectiveImmediately':
          dbEvent.i2 = value == 'false' ? 0 : 1;
          break
        case 'moniker':
          dbEvent.t2 = value;
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)

}