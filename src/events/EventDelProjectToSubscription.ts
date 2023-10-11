import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetTx } from "../setlatest";

/*
371879  {
  type: 'lava_del_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: '07042678b43520acb7e2c2e50d18a89e' }
  ]
}
*/

export const ParseEventDelProjectToSubscription = (
    evt: Event,
    height: number,
    txHash: string,
    lavaBlock: LavaBlock,
    static_dbProviders: Map<string, schema.Provider>,
    static_dbSpecs: Map<string, schema.Spec>,
    static_dbPlans: Map<string, schema.Plan>,
    static_dbStakes: Map<string, schema.ProviderStake[]>,
) => {
    const evtEvent: schema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: schema.LavaProviderEventType.DelProjectToSubscription,
        provider: null,
    }   

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'subscription':
                evtEvent.consumer = attr.value;
                break
            case 'projectName':
                evtEvent.t1 = attr.value;
                break
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbEvents.push(evtEvent)
 }