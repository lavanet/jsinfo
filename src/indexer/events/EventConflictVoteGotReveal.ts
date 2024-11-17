import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
458352 {
  type: 'lava_conflict_vote_got_reveal',
  attributes: [
      {
      key: 'voteID',
      value: 'lava@1mh9d3vdthekxvc0aflnvzhurv2585aakzs9e3alava@1zghevuyek94dth77a2cjzc0s09puc8tz04hneflava@1zvfemd9cagdw4aey6jl07nes6zvx43u6vfzf7y458250'
      },
      {
      key: 'provider',
      value: 'lava@1vfpuqq06426z3x4qsn38w6hdqrywqxlc6wmnxp'
      }
  ]
}
*/

export const ParseEventConflictVoteGotReveal = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,


  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.VoteGotReveal,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventConflictVoteGotReveal",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteID':
          dbEvent.t1 = value;
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