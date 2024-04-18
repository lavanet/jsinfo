import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
LavaBlockDebugDumpEvents txs event 1084948 lava_unbond_from_provider {
// effective_stake and stake are always 0 - tokens where taken out  

LavaBlockDebugDumpEvents txs event 1084948 lava_unstake_from_unbond {
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

LavaBlockDebugDumpEvents txs event 1058939 lava_unstake_from_unbond {
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
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {

  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.UnstakeFromUnbound,
    consumer: null,
    provider: null,
  }

  let moniker: string = '';

  if (!EventProcessAttributes("ParseEventUnstakeFromUnbound", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          evtEvent.t2 = value;
          break
        case 'min_self_delegation':
          evtEvent.b1 = EventParseUlava(value);
          break
        case 'moniker':
          moniker = value;
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, moniker)
  lavaBlock.dbEvents.push(evtEvent)
}