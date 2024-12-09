import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventProcessAttributes, EventParseProviderAddress, EventParseInt } from "../eventUtils";

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
    lavaBlock: LavaBlock
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.FreezeProvider,
        consumer: null,
    }

    if (!EventProcessAttributes({
        caller: "ParseEventFreezeProvider",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
        processAttribute: (key: string, value: string) => {
            switch (key) {
                case 'providerAddress':
                    dbEvent.provider = EventParseProviderAddress(value);
                    break
                case 'freezeReason':
                    dbEvent.t1 = value;
                    break
                case 'chainIDs':
                    dbEvent.t2 = value;
                    break
                case 'freezeRequestBlock':
                    dbEvent.i1 = EventParseInt(value)
                    break
            }
        },
        verifyFunction: () => !!dbEvent.provider
    })) return;



    lavaBlock.dbEvents.push(dbEvent)
}