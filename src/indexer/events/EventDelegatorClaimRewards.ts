
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
24Aug6 new sample:
{"claimed":"141991ibc/21E6274EDD0A68821E6C2FD4B243DF85EB86FF19920FF35FC18E68939DDE87CB,15253022710ulava","delegator":"lava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7cu"}

24Aug5 sample:
also confirmed by yarom this event is used
{"type":"lava_delegator_claim_rewards"}
delegator here is valid lavaid on testnet:
{"claimed":"465588965965ulava","delegator":"lava@1tlkpa7t48fjl7qan4ete6xh0lsy679flnqdw57"}

Aug2 notes:
SELECT * FROM events  WHERE event_type >= 1000 AND t1 not like '%lava_provider_temporary_jailed%' AND t1 not like '%cosmos.authz.v1beta1.EventGrant%' AND t1 not like '%lava_unstake_from_unbond%' ORDER BY "id" desc LIMIT 100

{
  "claimed": "239997ibc/21E6274EDD0A68821E6C2FD4B243DF85EB86FF19920FF35FC18E68939DDE87CB,148881ibc/77CDF8229441220A39DFD5E38B0AED466227B5DA8434BA8C7A90211A5E85C436,167443910703ulava",
  "delegator": "lava@1g7xt4prpusv8kutejj5rntg338q7s5uehaplcs"
}
{"type":"lava_delegator_claim_rewards"}
*/

export const ParseEventDelegatorClaimRewards = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  let delegator: string | null = null;

  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.DelegatorClaimRewards,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventDelegatorClaimRewards",
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
        case 'claimed':
          dbEvent.b1 = EventParseUlava(value);
          break
      }
    },
    verifyFunction: () => !!delegator
  })) return;

  dbEvent.provider = delegator;

  ;
  ;
  lavaBlock.dbEvents.push(dbEvent);
}