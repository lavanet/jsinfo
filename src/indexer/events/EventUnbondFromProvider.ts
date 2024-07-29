
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { GetOrSetProvider, SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
EventDebug txs event 1084948 lava_unbond_from_provider {
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

EventDebug txs event 1058939 lava_unbond_from_provider {
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
  blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
  blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  let delegator: string | null = null;
  let provider: string | null = null;

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.UbnondFromProvider,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventUbondFromProvider",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'delegator':
          if (value.startsWith('lava@')) delegator = EventParseProviderAddress(value);
          break;
        case 'provider':
          if (value.startsWith('lava@')) provider = EventParseProviderAddress(value);
          break;
        case 'chainID':
          dbEvent.t2 = value;
          break
        case 'amount':
          dbEvent.b1 = EventParseUlava(value);
          break
      }
    },
    verifyFunction: () => !!delegator || !!provider
  })) return;

  if (delegator !== provider) {
    const delegatorEvent = {
      ...dbEvent, provider:
        delegator,
      t1: provider ? `provider: ${provider}` : null,
    };
    GetOrSetProvider(lavaBlock.dbProviders, blockchainEntitiesProviders, delegatorEvent.provider!, '')
    lavaBlock.dbEvents.push(delegatorEvent);
  }

  dbEvent.provider = provider;
  dbEvent.t1 = delegator ? `delegator: ${delegator}` : null

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, blockchainEntitiesProviders, dbEvent.provider!, '')
  lavaBlock.dbEvents.push(dbEvent)
}