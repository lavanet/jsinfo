import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

/*
340837 {
  type: 'lava_conflict_vote_got_commit',
  attributes: [
    {
      key: 'voteID',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uchlava@1e4vghfjertxq25l2vv56egkfkvdjk90t0c667vlava@1y0ptxml00gxca086ghe9zcl906cu7ljgvk5m28340830'
    },
    {
      key: 'provider',
      value: 'lava@1kyhxrg453u6lfc77jwezyxrhy0laeuk69cpk4e'
    }
  ]
}
*/

export const ParseEventConflictVoteGotCommit = (
  evt: Event,
  height: number,
  txHash: string,
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
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'));
    }
    switch (key) {
      case 'voteID':
        evtEvent.voteId = attr.value;
        break
      case 'provider':
        evtEvent.provider = attr.value;
        break
    }
  })

  GetOrSetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbConflictVote.push(evtEvent)
}