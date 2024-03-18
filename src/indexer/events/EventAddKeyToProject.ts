import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavablock";
import * as schema from '../../schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";

/*
353983  {
  type: 'lava_add_key_to_project_event',
  attributes: [
    {
      key: 'project',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch-d064c8aa6149efbb98d633fcc7f50877'
    },
    {
      key: 'key',
      value: 'lava@1jups4splwaywrn0vsar59zg2z3l7sa9m7uhx4e'
    },
    { key: 'keytype', value: '2' },
    { key: 'block', value: '353983' }
  ]
}
*/

export const ParseEventAddKeyToProject = (
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
        eventType: schema.LavaProviderEventType.AddKeyToProject,
        provider: null,
    }
    evt.attributes.forEach((attr) => {
        let key: string = attr.key;
        if (attr.key.lastIndexOf('.') != -1) {
            key = attr.key.substring(0, attr.key.lastIndexOf('.'))
        }
        switch (key) {
            case 'project':
                evtEvent.t1 = attr.value;
                evtEvent.consumer = attr.value.split('-')[0];
                break
            case 'key':
                evtEvent.t2 = attr.value;
                break
            case 'keytype':
                evtEvent.i1 = parseInt(attr.value)
                break
            case 'block':
                evtEvent.blockId = parseInt(attr.value)
                break
        }
    })

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbEvents.push(evtEvent)
}