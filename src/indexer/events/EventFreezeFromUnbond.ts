import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetProvider, SetTx } from "../setlatest";
import { EventParseUlava, EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
https://github.com/lavanet/lava/blob/976bbd1063c66742b2f49465d39fe57ef6edff8a/x/dualstaking/keeper/delegate.go#L245

  details := map[string]string{
    "provider":        stakeEntry.Address,
    "chain_id":        stakeEntry.Chain,
    "moniker":         stakeEntry.Moniker,
    "stake":           stakeEntry.Stake.String(),
    "effective_stake": stakeEntry.EffectiveStake().String() + stakeEntry.Stake.Denom,
  }

  utils.LogLavaEvent(ctx, k.Logger(ctx), types.FreezeFromUnbond, details, "freezing provider due to stake below min spec stake")
*/

/*
LavaBlockDebugDumpEvents event 1068947 lava_freeze_from_unbond {
    type: "lava_freeze_from_unbond",
        attributes: [
            {
                key: "chain_id",
                value: "EVMOST",
            }, {
                key: "effective_stake",
                value: "49750165848ulava",
            }, {
                key: "min_spec_stake",
                value: "50000000000ulava",
            }, {
                key: "moniker",
                value: "seedvalidator",
            }, {
                key: "provider",
                value: "lava@1q9hy3dc9d9xve0j4r2cwdz3h7fqxccns0ru9yd",
            }, {
                key: "stake",
                value: "49750165848ulava",
            }
        ],
  }
  LavaBlockDebugDumpEvents event 1068947 lava_freeze_from_unbond {
    type: "lava_freeze_from_unbond",
        attributes: [
            {
                key: "chain_id",
                value: "EVMOS",
            }, {
                key: "effective_stake",
                value: "49750165848ulava",
            }, {
                key: "min_spec_stake",
                value: "50000000000ulava",
            }, {
                key: "moniker",
                value: "seedvalidator",
            }, {
                key: "provider",
                value: "lava@1q9hy3dc9d9xve0j4r2cwdz3h7fqxccns0ru9yd",
            }, {
                key: "stake",
                value: "49750165848ulava",
            }
        ],
  }
*/

export const ParseEventLavaFreezeFromUnbound = (
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
    eventType: JsinfoSchema.LavaProviderEventType.FreezeFromUnbond,
    consumer: null,
  }

  let moniker: string = '';

  if (!EventProcessAttributes(lavaBlock, "ParseEventLavaFreezeFromUnbound", {
    evt: evt,
    height: height,
    txHash: txHash,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'chain_id':
          evtEvent.t1 = value
          break
        case 'effective_stake':
          evtEvent.b1 = EventParseUlava(value)
          break
        case 'min_spec_stake':
          evtEvent.b3 = EventParseUlava(value)
          break
        case 'stake':
          evtEvent.b2 = EventParseUlava(value)
          break
        case 'provider':
          evtEvent.provider = EventParseProviderAddress(value);
          break
        case 'moniker':
          moniker = value;
          break
      }
    },
    verifyFunction: () => !!evtEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, moniker)
  lavaBlock.dbEvents.push(evtEvent)
}