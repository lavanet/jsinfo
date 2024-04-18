import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as schema from '../../schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";
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
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    const evtEvent: schema.InsertSubscriptionBuy = {
        blockId: height,
        tx: txHash,
    }

    if (!EventProcessAttributes("ParseEventBuySubscription", {
        evt: evt,
        height: height,
        txHash: txHash,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'consumer':
                    evtEvent.consumer = EventParseProviderAddress(value);
                    break
                case 'duration':
                    evtEvent.duration = EventParseInt(value)
                    break
                case 'plan':
                    evtEvent.plan = value;
                    break
            }
        },
        verifyFunction: () => !!evtEvent.consumer
    })) return;

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbSubscriptionBuys.push(evtEvent)
}