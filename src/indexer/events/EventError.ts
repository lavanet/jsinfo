import * as JsinfoSchema from '@jsinfo/schemas/jsinfoSchema/jsinfoSchema';
import { Attribute, Event } from "@cosmjs/stargate"
import { LavaBlock } from "../types";

import { EventExtractKeyFromAttribute } from '../eventUtils';
import { JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH } from '../indexerConsts';
import { JSONStringify } from '@jsinfo/utils/fmt';

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

    let eventAttributes: { [key: string]: string } = {};

    try {
        evt.attributes.forEach((attr: Attribute) => {
            let keysCounter = 0;
            keysCounter++;
            if (keysCounter > JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX) {
                return;
            }

            try {
                if (attr.key == "" || attr.value == "") return;
                if (attr.key.toLocaleLowerCase() == "<nil>" || attr.value == "<nil>") return;

                let key = EventExtractKeyFromAttribute(attr);
                let value = attr.value;

                if (key.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) {
                    key = key.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) + " ...";
                }

                if (value.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) {
                    value = value.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) + " ...";
                }

                eventAttributes[key] = value;
            } catch { }
        });
    } catch { }

    dbEvent.t1 = JSONStringify(parsedAttributes);
    dbEvent.fulltext = JSONStringify(eventAttributes).substring(0, 10000);


    lavaBlock.dbEvents.push(dbEvent)
}