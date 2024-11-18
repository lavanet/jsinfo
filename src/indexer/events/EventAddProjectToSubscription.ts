import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes, EventParseProviderAddress } from "../eventUtils";

/*
461785 {
  type: 'lava_add_project_to_subscription_event',
  attributes: [
    {
      key: 'subscription',
      value: 'lava@1qu0jm3ev9hl3l285wn8ppw8n7jtn9d2a2d5uch'
    },
    { key: 'projectName', value: '10e1d3dec0ab282312ea912f327596a1' }
  ]
}
*/

export const ParseEventAddProjectToSubscription = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.AddProjectToSubscription,
        provider: null,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventAddProjectToSubscription",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'subscription':
                    dbEvent.consumer = EventParseProviderAddress(value);
                    break
                case 'projectName':
                    dbEvent.t1 = value;
                    break
            }
        },
        verifyFunction: () => !!dbEvent.consumer
    })) return;



    lavaBlock.dbEvents.push(dbEvent)
}