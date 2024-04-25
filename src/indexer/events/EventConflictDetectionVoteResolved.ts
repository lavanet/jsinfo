import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
*/

export const ParseEventConflictDetectionVoteResolved = (
  evt: Event,
  height: number,
  txHash: string | null,
  lavaBlock: LavaBlock,
  static_dbProviders: Map<string, JsinfoSchema.Provider>,
  static_dbSpecs: Map<string, JsinfoSchema.Spec>,
  static_dbPlans: Map<string, JsinfoSchema.Plan>,
  static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
  const evtEvent: JsinfoSchema.InsertEvent = {
    tx: txHash,
    blockId: height,
    eventType: JsinfoSchema.LavaProviderEventType.DetectionVoteResolved,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes("ParseEventConflictDetectionVoteResolved", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'voteID':
          evtEvent.t1 = value
          break
        case 'winner':
          evtEvent.provider = EventParseProviderAddress(value)
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
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
  lavaBlock.dbEvents.push(evtEvent)
}