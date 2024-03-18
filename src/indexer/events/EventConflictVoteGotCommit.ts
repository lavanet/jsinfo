import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";

/*
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
  evt.attributes.forEach((attr) => {
    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
      key = attr.key.substring(0, attr.key.lastIndexOf('.'))
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

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbConflictVote.push(evtEvent)
}