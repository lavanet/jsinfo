import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { EventProcessAttributes } from "../eventUtils";
import { SetTx } from "../setLatest";

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

    dbEvent.t1 = JSON.stringify(parsedAttributes);

    SetTx(lavaBlock.dbTxs, txHash, height)
    lavaBlock.dbEvents.push(dbEvent)
}