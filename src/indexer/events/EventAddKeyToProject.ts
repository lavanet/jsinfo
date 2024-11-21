import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventParseInt, EventProcessAttributes } from "../eventUtils";

/*
error: {"code":-32603,"message":"Internal error","data":"height 799327 is not available, lowest height is 833001"}

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


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.AddKeyToProject,
        provider: null,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventAddKeyToProject",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'project':
                    dbEvent.t1 = value;
                    dbEvent.consumer = value.split('-')[0];
                    break
                case 'key':
                    dbEvent.t2 = value;
                    break
                case 'keytype':
                    dbEvent.i1 = EventParseInt(value)
                    break
                case 'block':
                    dbEvent.blockId = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!dbEvent.consumer
    })) return;

    lavaBlock.dbEvents.push(dbEvent)
}