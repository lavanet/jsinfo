import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";

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
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: schema.LavaProviderEventType.VoteGotReveal,
    consumer: null,
    provider: null,
  }

  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'))
    }
    switch (key) {
      case 'voteID':
        evtEvent.t1 = attr.value;
        break
      case 'provider':
        evtEvent.provider = attr.value;
        break
    }
  })

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}