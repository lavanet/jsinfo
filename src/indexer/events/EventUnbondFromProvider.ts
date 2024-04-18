
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
LavaBlockDebugDumpEvents txs event 1084948 lava_unbond_from_provider {
  type: "lava_unbond_from_provider",
  attributes: [
    {
      key: "amount",
      value: "50000000000ulava",
    }, {
      key: "chainID",
      value: "OPTM",
    }, {
      key: "delegator",
      value: "lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z",
    }, {
      key: "provider",
      value: "lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z",
    }
  ],
}

LavaBlockDebugDumpEvents txs event 1058939 lava_unbond_from_provider {
    type: "lava_unbond_from_provider",
    attributes: [
      {
        key: "amount",
        value: "50000000000ulava",
      }, {
        key: "chainID",
        value: "AVAX",
      }, {
        key: "delegator",
        value: "lava@163qw77zapfu5zvs0tfkalclajdnz2nvg4fj2w6",
      }, {
        key: "provider",
        value: "lava@163qw77zapfu5zvs0tfkalclajdnz2nvg4fj2w6",
      }
    ],
  }
*/

export const ParseEventUbondFromProvider = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  let delegator: string | null = null;
  let provider: string | null = null;

  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.UbnondFromProvider,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes("ParseEventUbondFromProvider", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'delegator':
          if (value.startsWith('lava@')) delegator = EventParseProviderAddress(value);
          break;
        case 'provider':
          if (value.startsWith('lava@')) provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          evtEvent.t2 = value;
          break
        case 'amount':
          evtEvent.b1 = EventParseUlava(value);
          break
      }
    },
    verifyFunction: () => !!delegator || !!provider
  })) return;

  if (delegator !== provider) {
    const delegatorEvent = {
      ...evtEvent, provider:
        delegator,
      t1: provider ? `provider: ${provider}` : null,
    };
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, delegatorEvent.provider!, '')
    lavaBlock.dbEvents.push(delegatorEvent);
  }

  evtEvent.provider = provider;
  evtEvent.t1 = delegator ? `delegator: ${delegator}` : null

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}