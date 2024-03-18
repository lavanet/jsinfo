import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";

/*
351669  {
  type: 'lava_del_key_from_project_event',
  attributes: [
    {
      key: 'project',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-d064c8aa6149efbb98d633fcc7f50877'
    },
    {
      key: 'key',
      value: 'lava@1h5klcufu5ldyqzjcwdzz8qlx6yh7ytwvwa9ra3'
    },
    { key: 'keytype', value: '2' },
    { key: 'block', value: '351669' }
  ]
}
*/

export const ParseEventDelKeyFromProject = (
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
        eventType: schema.LavaProviderEventType.DelKeyFromProject,
        provider: null,
    }

    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'))
        }
        switch (key) {
            case 'project':
                evtEvent.consumer = attr.value.split('-')[0];
                break
            case 'key':
                evtEvent.t2 = attr.value;
                break
            case 'keytype':
                evtEvent.i1 = parseInt(attr.value)
                break
            case 'block':
                evtEvent.i2 = parseInt(attr.value)
                break
        }
    })

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbEvents.push(evtEvent)
}