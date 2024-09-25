import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
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


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.StakeUpdateProvider,
    consumer: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventStakeUpdateProvider",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'stakeAppliedBlock':
          dbEvent.i1 = EventParseInt(value)
          break
        case 'stake':
          dbEvent.b1 = EventParseUlava(value)
          break
        case 'moniker':
          dbEvent.t1 = value;
          break
        case 'spec':
          dbEvent.t2 = value;
          break
        case 'provider':
          dbEvent.provider = EventParseProviderAddress(value);
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;



  lavaBlock.dbEvents.push(dbEvent)
}