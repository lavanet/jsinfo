import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, GetOrSetTx } from "../setlatest";

/*
//block 344537
lava_freeze_provider {
  type: 'lava_freeze_provider',
  attributes: [
    { key: 'freezeReason', value: 'maintenance' },
    {
      key: 'providerAddress',
      value: 'lava@1vu3xj8yv8280mx5pt64q4xg37692txwm422ymp'
    },
    { key: 'chainIDs', value: 'POLYGON1' },
    { key: 'freezeRequestBlock', value: '344537' }
  ]
}
*/

export const ParseEventFreezeProvider = (
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
        eventType: schema.LavaProviderEventType.FreezeProvider,
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
            case 'freezeReason':
                evtEvent.t1 = attr.value;
                break
            case 'chainIDs':
                evtEvent.t2 = attr.value;
                break
            case 'freezeRequestBlock':
                evtEvent.i1 = parseInt(attr.value);
                break
         }
    })

    GetOrSetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}