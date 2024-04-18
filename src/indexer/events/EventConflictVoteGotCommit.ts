import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
LavaBlockDebugDumpEvents txs event 1082976 lava_conflict_vote_got_commit {
  type: "lava_conflict_vote_got_commit",
  attributes: [
    {
      key: "provider",
      value: "lava@1pphkhh9g0aqmq6jpksr54w8a8hypr8g4jngx9y",
    }, {
      key: "voteID",
      value: "lava@1t74mf6pkerr0s7lren5uhfh9elru24n77rmxpnlava@1fpprhv40h9z058ez0hxdattjvg0fjsrhkqc7culava@1yx3c6h0gceg3pwz7vsed6mqwftu0456mcs4am91082940",
    }
  ],
}

461844 {
  type: 'lava_conflict_vote_got_commit',
  attributes: [
    {
      key: 'provider',
      value: 'lava@1l57uxerrqsclr2y6srzv8e3y5tcrlyjpvaldpp'
    },
    {
      key: 'voteID',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uchlava@1f8kg6htavv67x4e54j6zvlg6pwzcsg52k3wu80lava@1j6xsjzvccykc08sz2xe4l2j4a3er64qf8dc9jw461820'
    }
  ]
}
*/

export const ParseEventConflictVoteGotCommit = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, schema.Provider>,
  static_dbSpecs: Map<string, schema.Spec>,
  static_dbPlans: Map<string, schema.Plan>,
  static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
  const evtEvent: schema.InsertConflictVote = {
    blockId: height,
    tx: txHash,
  }

  if (!EventProcessAttributes("ParseEventConflictVoteGotCommit", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteID':
          evtEvent.voteId = value;
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbConflictVote.push(evtEvent)
}