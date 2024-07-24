import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";
import { SetTx } from "../blockchainEntities/blockchainEntitiesGettersAndSetters";

export const ParseEventError = (
    evt: Event,
    height: number,
    txHash: string | null,
    lavaBlock: LavaBlock,
    error: unknown,
    caller: string,
) => {
    const dbEvent: JsinfoSchema.InsertEvent = {
        tx: txHash,
        blockId: height,
        eventType: JsinfoSchema.LavaProviderEventType.ErrorEvent,
        provider: null,
    }

    let parsedAttributes = { type: evt.type, error: String(error).substring(0, 4000), caller: caller };

    dbEvent.t1 = JSON.stringify(parsedAttributes);

    SetTx(lavaBlock.dbTxs, txHash, height)
    lavaBlock.dbEvents.push(dbEvent)
}