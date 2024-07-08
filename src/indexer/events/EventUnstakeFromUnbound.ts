import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { GetOrSetProvider, SetTx } from "../setLatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

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
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
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
          dbEvent.provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          dbEvent.t2 = value;
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

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, dbEvent.provider!, moniker)
  lavaBlock.dbEvents.push(dbEvent)
}