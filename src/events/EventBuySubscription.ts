import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetTx } from "../setlatest";

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
    txHash: string,
    lavaBlock: LavaBlock,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    const evtEvent: schema.InsertSubscriptionBuy = {
        blockId: height,
        tx: txHash,
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'consumer':
                evtEvent.consumer = attr.value;
                break
            case 'duration':
                evtEvent.duration = parseInt(attr.value);
                break
            case 'plan':
                evtEvent.plan = attr.value;
                break
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbSubscriptionBuys.push(evtEvent)
}