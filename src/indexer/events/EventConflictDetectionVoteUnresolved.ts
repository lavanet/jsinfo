import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { SetTx } from "../setLatest";
import { EventParseInt, EventProcessAttributes } from "../eventUtils";

/*
EventDebug event 1083240 lava_conflict_detection_vote_unresolved {
  type: "lava_conflict_detection_vote_unresolved",
  attributes: [
    {
      key: "FirstProviderVotes",
      value: "0",
    }, {
      key: "NoneProviderVotes",
      value: "0",
    }, {
      key: "NumOfNoVoters",
      value: "8",
    }, {
      key: "NumOfVoters",
      value: "0",
    }, {
      key: "RewardPool",
      value: "0",
    }, {
      key: "SecondProviderVotes",
      value: "0",
    }, {
      key: "TotalVotes",
      value: "2745108140281",
    }, {
      key: "voteFailed",
      value: "not_enough_voters",
    }, {
      key: "voteID",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpnlava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7culava@1yx3c6h0gceg3pwz7vsed6mqwftu0456mcs4am91082940",
    }
  ],
}

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
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.DetectionVoteUnresolved,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventConflictDetectionVoteUnresolved",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteID':
          dbEvent.t1 = value
          break
        case 'voteFailed':
          dbEvent.t2 = value
          break

        case 'NumOfNoVoters':
          dbEvent.i1 = EventParseInt(value) // len https://github.com/lavanet/lava/blob/main/x/conflict/keeper/vote.go#L135
          break
        case 'NumOfVoters':
          dbEvent.i2 = EventParseInt(value) // leb
          break

        case 'RewardPool':
          dbEvent.b1 = EventParseInt(value)
          break
        case 'TotalVotes':
          dbEvent.b2 = EventParseInt(value) // stake
          break

        /*case 'FirstProviderVotes':
          dbEvent.b1 = EventParseInt(value) // stake
          break
        case 'NoneProviderVotes':
          dbEvent.b2 = EventParseInt(value) // stake
          break
        case 'SecondProviderVotes':
          dbEvent.b2 = EventParseInt(value)
          break*/
      }
    },
    verifyFunction: null
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(dbEvent)
}