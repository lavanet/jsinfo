import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetConsumer, GetOrSetTx } from "../setlatest";

/*
341737  {
  type: 'lava_add_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: 'f195d68175eb091ec1f71d00f8952b85' }
  ]
}
*/

export const ParseEventAddProjectToSubscription = (
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
        eventType: schema.LavaProviderEventType.AddProjectToSubscription,
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