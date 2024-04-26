import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { EventProcessAttributes } from "../eventUtils";

export const ParseEventUnidentified = (
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
        eventType: JsinfoSchema.LavaProviderEventType.UnidentifiedEvent,
        provider: null,
    }

    let parsedAttributes = { type: evt.type };

    if (!EventProcessAttributes("ParseEventUnidentified", {
        evt: evt,
        height: height,
        txHash: txHash,
        processAttribute: (key: string, value: string) => {
            parsedAttributes[key] = value
        },
        verifyFunction: null,
    })) return;

    evtEvent.t1 = JSON.stringify(parsedAttributes);

    lavaBlock.dbEvents.push(evtEvent)
}