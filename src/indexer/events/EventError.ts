import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { EventProcessAttributes } from "../eventUtils";

export const ParseEventError = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,
    error: unknown,
    caller: string,
) => {
    const evtEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.ErrorEvent,
        provider: null,
    }

    let parsedAttributes = { type: evt.type, error: String(error).substring(0, 4000), caller: caller };

    EventProcessAttributes(lavaBlock, "ParseEventError", {
        evt: evt,
        height: height,
        txHash: txHash,
        processAttribute: (key: string, value: string) => {
            parsedAttributes[key] = value
        },
        verifyFunction: null,
    })

    evtEvent.t1 = JSON.stringify(parsedAttributes);

    lavaBlock.dbEvents.push(evtEvent)
}