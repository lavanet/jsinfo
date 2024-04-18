import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { SetTx } from "../setlatest";
import { EventParseInt, EventProcessAttributes } from "../eventUtils";

/*
LavaBlockDebugDumpEvents event 1083240 lava_conflict_detection_vote_unresolved {
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

  if (!EventProcessAttributes("ParseEventConflictDetectionVoteUnresolved", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteID':
          evtEvent.t1 = value
          break
        case 'voteFailed':
          evtEvent.t2 = value
          break

        case 'NumOfNoVoters':
          evtEvent.i1 = EventParseInt(value) // len https://github.com/lavanet/lava/blob/main/x/conflict/keeper/vote.go#L135
          break
        case 'NumOfVoters':
          evtEvent.i2 = EventParseInt(value) // leb
          break

        case 'RewardPool':
          evtEvent.b1 = EventParseInt(value)
          break
        case 'TotalVotes':
          evtEvent.b2 = EventParseInt(value) // stake
          break

        /*case 'FirstProviderVotes':
          evtEvent.b1 = EventParseInt(value) // stake
          break
        case 'NoneProviderVotes':
          evtEvent.b2 = EventParseInt(value) // stake
          break
        case 'SecondProviderVotes':
          evtEvent.b2 = EventParseInt(value)
          break*/
      }
    },
    verifyFunction: null
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(evtEvent)
}