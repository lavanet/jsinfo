import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { GetOrSetConsumer, SetTx } from "../setLatest";
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
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.DelKeyFromProject,
        provider: null,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventDelKeyFromProject",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'project':
                    dbEvent.consumer = value.split('-')[0];
                    break
                case 'key':
                    dbEvent.t2 = EventParseProviderAddress(value);
                    break
                case 'keytype':
                    dbEvent.i1 = EventParseInt(value)
                    break
                case 'block':
                    dbEvent.i2 = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!dbEvent.consumer
    })) return;

    SetTx(lavaBlock.dbTxs, txHash, height)
    GetOrSetConsumer(lavaBlock.dbConsumers, dbEvent.consumer!)
    lavaBlock.dbEvents.push(dbEvent)
}