import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventParseInt, EventProcessAttributes } from "../eventUtils";

/* 
{"type":"lava_distribution_pools_refill","allocation_pool_remaining_lifetime":"43","leftover_burn_rate":"1.000000000000000000","next_refill_block":"1229316","next_refill_time":"2024-05-27 12:23:34 +0000 UTC","providers_distribution_pool_balance":"769821204696102","validators_distribution_pool_balance":"769840294693826"}
*/

export const ParseDistributionPoolsRefill = (
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
    eventType: JsinfoSchema.LavaProviderEventType.DistributionPoolsRefill,
    consumer: null,
    provider: null,
  }

  if (!EventProcessAttributes({
    caller: "ParseDistributionPoolsRefill",
    lavaBlock: lavaBlock,
    evt: evt,
    height: height,
    txHash: txHash,
    dbEvent: dbEvent,
    processAttribute: (key: string, value: string) => {
      switch (key) {
        case 'allocation_pool_remaining_lifetime':
          dbEvent.i1 = EventParseInt(value);
          break;
        case 'next_refill_block':
          dbEvent.i2 = EventParseInt(value);
          break;
        case 'providers_distribution_pool_balance':
          dbEvent.i3 = EventParseInt(value);
          break;
        case 'next_refill_time':
          dbEvent.t1 = value;
          break;

      }
    },
    verifyFunction: () => !!dbEvent.provider
  })) return;

  SetTx(lavaBlock.dbTxs, txHash, height)
  lavaBlock.dbEvents.push(dbEvent)
}
