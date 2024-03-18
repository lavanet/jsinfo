import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { SetTx } from "../setlatest";

/*
486510 {
  type: 'lava_conflict_detection_vote_unresolved',
  attributes: [
      { key: 'FirstProviderVotes', value: '0' },
      { key: 'NoneProviderVotes', value: '0' },
      { key: 'NumOfNoVoters', value: '6' },
      { key: 'NumOfVoters', value: '0' },
      { key: 'RewardPool', value: '0' },
      { key: 'SecondProviderVotes', value: '0' },
      { key: 'TotalVotes', value: '12964000000000' },
      { key: 'voteFailed', value: 'not_enough_voters' },
      {
      key: 'voteID',
      value: 'lava@1mh9d3vdthekxvc0aflnvzhurv2585aakzs9e3alava@1f8kg6htavv67x4e54j6zvlg6pwzcsg52k3wu80lava@1uhwudw7vzqtnffu2hf5yhv4n8trj79ezl66z99486360'
      }
  ]
}
*/

export const ParseEventConflictDetectionVoteUnresolved = (
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
    eventType: schema.LavaProviderEventType.DetectionVoteUnresolved,
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
        evtEvent.t1 = attr.value
        break
      case 'voteFailed':
        evtEvent.t2 = attr.value
        break

      case 'NumOfNoVoters':
        evtEvent.i1 = parseInt(attr.value) // len https://github.com/lavanet/lava/blob/main/x/conflict/keeper/vote.go#L135
        break
      case 'NumOfVoters':
        evtEvent.i2 = parseInt(attr.value) // leb
        break

      case 'RewardPool':
        evtEvent.b1 = parseInt(attr.value)
        break
      case 'TotalVotes':
        evtEvent.b2 = parseInt(attr.value) // stake
        break

      /*case 'FirstProviderVotes':
        evtEvent.b1 = parseInt(attr.value) // stake
        break
      case 'NoneProviderVotes':
        evtEvent.b2 = parseInt(attr.value) // stake
        break
      case 'SecondProviderVotes':
        evtEvent.b2 = parseInt(attr.value)
        break*/
    }
  })

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(evtEvent)
}