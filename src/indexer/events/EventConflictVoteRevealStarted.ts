import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { SetTx } from "../setlatest";

/*
486510 {
  type: 'lava_conflict_vote_reveal_started',
  attributes: [
      { key: 'voteDeadline', value: '486570' },
      {
      key: 'voteID',
      value: 'lava@1mh9d3vdthekxvc0aflnvzhurv2585aakzs9e3alava@1f8kg6htavv67x4e54j6zvlg6pwzcsg52k3wu80lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z486390'
      }
  ]
}
*/

export const ParseEventConflictVoteRevealStarted = (
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
    eventType: schema.LavaProviderEventType.VoteRevealStarted,
    consumer: null,
    provider: null,
  }

  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'))
    }
    switch (key) {
      case 'voteDeadline':
        evtEvent.i1 = parseInt(attr.value)
        break
      case 'voteID':
        evtEvent.t1 = attr.value;
        break
    }
  })

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(evtEvent)
}