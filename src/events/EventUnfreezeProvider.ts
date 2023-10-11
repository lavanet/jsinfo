import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

/*
//block 360494
lava_unfreeze_provider {
  type: 'lava_unfreeze_provider',
  attributes: [
    {
      key: 'providerAddress',
      value: 'lava@1q7jyftyahuf66jefc36254rldk6je9xkf5t79z'
    },
    { key: 'chainIDs', value: 'FTM250' }
  ]
}
*/

export const ParseEventUnfreezeProvider = (
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
        eventType: schema.LavaProviderEventType.UnfreezeProvider,
        consumer: null,
    }

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'));
        }
        switch (key) {
            case 'providerAddress':
                evtEvent.provider = attr.value;
                break
            case 'chainIDs':
                evtEvent.t1 = attr.value;
                break
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}