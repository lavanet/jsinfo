import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { GetOrSetConsumer, SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

/*
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
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
    blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
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

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, dbEvent.consumer!)
    lavaBlock.dbSubscriptionBuys.push(dbEvent)
}