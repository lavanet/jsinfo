import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../lavaTypes";
import { EventProcessAttributes } from "../eventUtils";

import { JSONStringify } from '@jsinfo/utils/fmt';

export const ParseEventUnidentified = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,


    blockchainEntitiesStakes: Map<string, JsinfoSchema.InsertProviderStake[]>,
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.UnidentifiedEvent,
        provider: null,
    }

    let parsedAttributes = { type: evt.type };

    EventProcessAttributes({
        caller: "ParseEventUnidentified",
        lavaBlock: lavaBlock,
        evt: evt,
        height: height,
        txHash: txHash,
        dbEvent: dbEvent,
    });

    dbEvent.t1 = JSONStringify(parsedAttributes);


    lavaBlock.dbEvents.push(dbEvent)
}