import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
// 5aug24 - confirmed with yarom, this event is used

// original sample:
360227  {
  type: 'lava_buy_subscription_event',
  attributes: [
    {
      key: 'consumer',
      value: 'lava@1zw9r5rrslceh5c6pkxy73lrsnr2a7ntdt36gxc'
    },
    { key: 'duration', value: '6' },
    { key: 'plan', value: 'whale' }
  ]
}
*/

export const ParseEventBuySubscription = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
    const dbEvent: JsinfoSchema.InsertSubscriptionBuy = {
        blockId: height,
        tx: txHash,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventBuySubscription",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'consumer':
                    dbEvent.consumer = EventParseProviderAddress(value);
                    break
                case 'duration':
                    dbEvent.duration = EventParseInt(value)
                    break
                case 'plan':
                    dbEvent.plan = value;
                    break
            }
        },
        verifyFunction: () => !!dbEvent.consumer
    })) return;



    lavaBlock.dbSubscriptionBuys.push(dbEvent)
}