import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventParseInt, EventProcessAttributes } from "../eventUtils";

/*
EventDebug event 1083120 lava_conflict_vote_reveal_started {
  type: "lava_conflict_vote_reveal_started",
  attributes: [
    {
      key: "voteDeadline",
      value: "1083240",
    }, {
      key: "voteID",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpnlava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7culava@1yx3c6h0gceg3pwz7vsed6mqwftu0456mcs4am91082940",
    }
  ],
}

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

/*
  eventData := map[string]string{}
  eventData["voteID"] = conflictVote.Index
  eventData["voteDeadline"] = strconv.FormatUint(conflictVote.VoteDeadline, 10)
  utils.LogLavaEvent(ctx, logger, types.ConflictVoteRevealEventName, eventData, "Vote is now in reveal state")
*/

export const ParseEventConflictVoteRevealStarted = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
  blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
  blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
  const dbEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.VoteRevealStarted,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseEventConflictVoteRevealStarted",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteDeadline':
          dbEvent.i1 = EventParseInt(value)
          break
        case 'voteID':
          dbEvent.t1 = value;
          break
      }
    },
    verifyFunction: null
  })) return;


  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(dbEvent)
}