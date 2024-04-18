import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
event 1085739 lava_stake_update_provider {
  type: "lava_stake_update_provider",
  attributes: [
    {
      key: "moniker",
      value: "BabyScope",
    }, {
      key: "provider",
      value: "lava@18rtt3ka0jc85qvvcnct0t7ayq6fva7692k9kvh",
    }, {
      key: "spec",
      value: "EVMOST",
    }, {
      key: "stake",
      value: "50000000000ulava",
    }, {
      key: "stakeAppliedBlock",
      value: "1085740",
    }
  ],
}

//block 340898
lava_stake_update_provider {
  type: 'lava_stake_update_provider',
  attributes: [
    { key: 'stakeAppliedBlock', value: '340899' },
    { key: 'stake', value: '50000000000ulava' },
    { key: 'moniker', value: 'MELLIFERA' },
    { key: 'spec', value: 'LAV1' },
    {
      key: 'provider',
      value: 'lava@1rgs6cp3vleue3vwffrvttjtl4laqhk8fthu466'
    }
  ]
}
*/



export const ParseEventStakeUpdateProvider = (
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
    eventType: schema.LavaProviderEventType.StakeUpdateProvider,
    consumer: null,
  }

  if (!EventProcessAttributes("ParseEventStakeUpdateProvider", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'stakeAppliedBlock':
          evtEvent.i1 = EventParseInt(value)
          break
        case 'stake':
          evtEvent.b1 = EventParseUlava(value)
          break
        case 'moniker':
          evtEvent.t1 = value;
          break
        case 'spec':
          evtEvent.t2 = value;
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}