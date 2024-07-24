import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { EventProcessAttributes } from "../eventUtils";
import { SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";

export const ParseEventUnidentified = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,
    blockchainEntitiesProviders: Map<string, JsinfoSchema.Provider>,
    blockchainEntitiesSpecs: Map<string, JsinfoSchema.Spec>,
    blockchainEntitiesStakes: Map<string, JsinfoSchema.ProviderStake[]>,
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