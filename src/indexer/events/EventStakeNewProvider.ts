import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
LavaBlockDebugDumpEvents txs event 1074270 lava_stake_new_provider {
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
  const evtEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.StakeNewProvider,
    consumer: null,
  }

  if (!EventProcessAttributes(lavaBlock, "ParseEventStakeNewProvider", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'spec':
          evtEvent.t1 = value;
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'stakeAppliedBlock':
          evtEvent.i1 = EventParseInt(value)
          break
        case 'stake':
          evtEvent.b1 = EventParseUlava(value)
          break
        case 'geolocation':
          evtEvent.i1 = EventParseInt(value)
          break
        case 'effectiveImmediately':
          evtEvent.i2 = value == 'false' ? 0 : 1;
          break
        case 'moniker':
          evtEvent.t2 = value;
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)

}