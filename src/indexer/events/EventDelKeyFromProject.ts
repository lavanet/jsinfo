import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { GetOrSetConsumer, SetTx } from "../setlatest";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

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
    static_dbProviders: Map<string, JsinfoSchema.Provider>,
    static_dbSpecs: Map<string, JsinfoSchema.Spec>,
    static_dbPlans: Map<string, JsinfoSchema.Plan>,
    static_dbStakes: Map<string, JsinfoSchema.ProviderStake[]>,
) => {
    const evtEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.DelKeyFromProject,
        provider: null,
    }

    if (!EventProcessAttributes("ParseEventDelKeyFromProject", {
        evt: evt,
        height: height,
        txHash: txHash,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'project':
                    evtEvent.consumer = value.split('-')[0];
                    break
                case 'key':
                    evtEvent.t2 = EventParseProviderAddress(value);
                    break
                case 'keytype':
                    evtEvent.i1 = EventParseInt(value)
                    break
                case 'block':
                    evtEvent.i2 = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!evtEvent.consumer
    })) return;

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, evtEvent.consumer!)
    lavaBlock.dbEvents.push(evtEvent)
}