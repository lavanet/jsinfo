import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { SetTx } from "../setLatest";
import { EventProcessAttributes, EventParseFloat } from "../eventUtils";

/* 
Validators already have info on the nativ explorers, this info is not shown on jsinfo

EventDebug event 1068947 lava_validator_slash {
    type: "lava_validator_slash",
    attributes: [
      {
        key: "slash_fraction",
        value: "0.004999999706060451",
      }, {
        key: "validator_address",
        value: "lava@valoper193p69ej0tq6tz9z3mfz5m8nn0lrhj6qdn32d5g",
      }
    ],
  }

1499721	1000	 	1137740	{"type":"lava_validator_slash","slash_fraction":"0.004999998332364468","validator_address":"lava@valoper13sjlfk3hys245nm04ljjmg6pf6l8qtaqk0flnq"}
*/

export const ParseValidatorSlash = (
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
    eventType: JsinfoSchema.LavaProviderEventType.ValidtorSlash,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseValidatorSlash",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'slash_fraction':
          dbEvent.r1 = EventParseFloat(value);
          break;
        case 'validator_address':
          dbEvent.t1 = value;
          break
      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(dbEvent)
}
