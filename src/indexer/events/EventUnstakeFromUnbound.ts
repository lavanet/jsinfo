import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

// After 2Aug2024
// {"type":"lava_unstake_from_unbond","error":"verifyFunctionCalledAndFailed","caller":"ParseEventUnstakeFromUnbound"}
/*
{
  "type": "lava_unstake_from_unbond",
  "attributes": [
    {
      "key": "chain_id",
      "value": "BLASTSP",
      "index": true
    },
    {
      "key": "description",
      "value": "moniker: SGTstake\n",
      "index": true
    },
    {
      "key": "effective_stake",
      "value": "0ulava",
      "index": true
    },
    {
      "key": "min_self_delegation",
      "value": "100000000ulava",
      "index": true
    },
    {
      "key": "moniker",
      "value": "SGTstake",
      "index": true
    },
    {
      "key": "provider_provider",
      "value": "lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99",
      "index": true
    },
    {
      "key": "provider_vault",
      "value": "lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99",
      "index": true
    },
    {
      "key": "stake",
      "value": "0ulava",
      "index": true
    }
  ]
}
  */

// Before 2Aug2024
/*
EventDebug txs event 1084948 lava_unbond_from_provider {
// effective_stake and stake are always 0 - tokens where taken out  

EventDebug txs event 1084948 lava_unstake_from_unbond {
  type: "lava_unstake_from_unbond",
  attributes: [
    {
      key: "chain_id",
      value: "OPTM",
    }, {
      key: "effective_stake",
      value: "0ulava",
    }, {
      key: "min_self_delegation",
      value: "100000000ulava",
    }, {
      key: "moniker",
      value: "Impulse",
    }, {
      key: "provider",
      value: "lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z",
    }, {
      key: "stake",
      value: "0ulava",
    }
  ],
}

EventDebug txs event 1058939 lava_unstake_from_unbond {
    type: "lava_unstake_from_unbond",
    attributes: [
      {
        key: "chain_id",
        value: "AVAX",
      }, {
        key: "effective_stake",
        value: "0ulava",
      }, {
        key: "min_self_delegation",
        value: "100000000ulava",
      }, {
        key: "moniker",
        value: "F5 Nodes",
      }, {
        key: "provider",
        value: "lava@163qw77zapfu5zvs0tfkalclajdnz2nvg4fj2w6",
      }, {
        key: "stake",
        value: "0ulava",
      }
    ],
  }
*/

export const ParseEventUnstakeFromUnbound = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.UnstakeFromUnbound,
    consumer: null,
    provider: null,
  }

  let moniker: string = '';

  if (!EventProcessAttributes({
    caller: "ParseEventUnstakeFromUnbound",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'provider':
          if (dbEvent.provider) break;
          dbEvent.provider = EventParseProviderAddress(value);
          break;
        case 'provider_provider':
          if (dbEvent.provider) break;
          dbEvent.provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          dbEvent.t2 = value;
          break
        case 'provider_vault':
          dbEvent.t3 = value;
          break
        case 'min_self_delegation':
          dbEvent.b1 = EventParseUlava(value);
          break
        case 'moniker':
          moniker = value;
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  lavaBlock.dbEvents.push(dbEvent)
}