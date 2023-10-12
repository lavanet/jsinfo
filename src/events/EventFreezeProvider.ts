import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../schema';
import { GetOrSetProvider, SetTx } from "../setlatest";

/*
462524 {
  type: 'lava_freeze_provider',
  attributes: [
    { key: 'freezeReason', value: 'maintenance' },
    {
      key: 'providerAddress',
      value: 'lava@1m5p9cc4lp6jxdsk3pdf56tek2muzu3sm4rhp5f'
    },
    { key: 'chainIDs', value: 'COS5' },
    { key: 'freezeRequestBlock', value: '462524' }
  ]
}
*/

export const ParseEventFreezeProvider = (
    evt: Event,
    height: number,
    txHash: string | null,
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
            key = attr.key.substring(0, attr.key.lastIndexOf('.'))
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
                evtEvent.i1 = parseInt(attr.value)
                break
         }
    })

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetProvider(lavaBlock.dbProviders, static_dbProviders, evtEvent.provider!, '')
    lavaBlock.dbEvents.push(evtEvent)
}