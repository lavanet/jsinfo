
import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
ProcessOneEvent:: Uknown event 1020208 lava_redelegate_between_providers {
  type: "lava_redelegate_between_providers",
  attributes: [
    {
      key: "amount",
      value: "50000000250ulava",
    }, {
      key: "delegator",
      value: "lava@1rlmnaesfzh52tdlljxaz006h8s3gsrtvexv67f",
    }, {
      key: "from_chainID",
      value: "ETH1",
    }, {
      key: "from_provider",
      value: "lava@10csstu4lsjqwuf7ssa2nqx6rkx0qurhvw2nypq",
    }, {
      key: "to_chainID",
      value: "SEP1",
    }, {
      key: "to_provider",
      value: "lava@1rlmnaesfzh52tdlljxaz006h8s3gsrtvexv67f",
    }
  ],
}
*/

export const ParseEventRedelegateBetweenProviders = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  let delegator: string | null = null;
  let from_provider: string | null = null;
  let to_provider: string | null = null;
  let from_chainID: string | null = null;
  let to_chainID: string | null = null;

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.RedelegateBetweenProviders,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "EventRedelegateBetweenProviders",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'delegator':
          delegator = EventParseProviderAddress(value);
          break;
        case 'from_provider':
          from_provider = EventParseProviderAddress(value);
          break;
        case 'to_provider':
          to_provider = EventParseProviderAddress(value);
          break;
        case 'from_chainID':
          from_chainID = value;
          break
        case 'to_chainID':
          to_chainID = value;
          break
        case 'amount':
          dbEvent.b1 = EventParseUlava(value);
          break
      }
    },
    verifyFunction: () => !!delegator || !!from_provider || !!to_provider
  })) return;


  let providerInfo = `delegator: ${delegator}, from_provider: ${from_provider}, to_provider: ${to_provider}`;
  let chainInfo = `from_chain: ${from_chainID}, to_chain: ${to_chainID}`;

  dbEvent.t1 = providerInfo;
  dbEvent.t2 = chainInfo;

  if (delegator !== from_provider) {
    const fromProviderEvent = {
      ...dbEvent,
      provider: from_provider,
    };

    lavaBlock.dbEvents.push(fromProviderEvent);
  }

  if (delegator !== to_provider) {
    const toProviderEvent = {
      ...dbEvent,
      provider: to_provider,
    };

    lavaBlock.dbEvents.push(toProviderEvent);
  }

  ;
  ;
  lavaBlock.dbEvents.push(dbEvent);

}