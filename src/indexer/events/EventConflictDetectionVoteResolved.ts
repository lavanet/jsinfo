import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";

/*
*/

export const ParseEventConflictDetectionVoteResolved = (
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
    eventType: schema.LavaProviderEventType.DetectionVoteResolved,
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
      case 'winner':
        evtEvent.provider = attr.value
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
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}