// jsinfo/src/indexer/eventUtils.ts

import { Event, Attribute } from "@cosmjs/stargate"
import { JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH } from './indexerConsts';
import { ParseEventError } from "./events/EventError";
import { LavaBlock } from "./types";
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import { JSONStringify, logger, ParseUlavaToBigInt } from "../utils/utils";

export function EventExtractKeyFromAttribute(attr: Attribute): string {
    if (attr.key.length < 2) {
        throw new Error(`EventExtractKeyFromAttribute: Key length is less than 2`);
    }

    let key: string = attr.key;
    if (attr.key.lastIndexOf('.') != -1) {
        key = attr.key.substring(0, attr.key.lastIndexOf('.'))
    }
    return key;
}

// Test 1: Key length is less than 2
try {
    EventExtractKeyFromAttribute({ key: 'a', value: "" });
    logger.error('EventExtractKeyFromAttribute Test 1 failed: Expected an error for key length less than 2');
} catch (error) {
}

// Test 2: Key does not contain a dot
try {
    const result = EventExtractKeyFromAttribute({ key: 'testKey', value: "" });
    if (result !== 'testKey') {
        logger.error('EventExtractKeyFromAttribute Test 2 failed: Expected "testKey", got', result);
    } else {
    }
} catch (error) {
    logger.error('EventExtractKeyFromAttribute Test 2 failed with error:', error);
    throw "EventExtractKeyFromAttribute Test 2 failed";
}

// Test 3: Key contains a dot
try {
    const result = EventExtractKeyFromAttribute({ key: 'test.key', value: "" });
    if (result !== 'test') {
        logger.error('EventExtractKeyFromAttribute Test 3 failed: Expected "test", got', result);
    } else {
    }
} catch (error) {
    logger.error('EventExtractKeyFromAttribute Test 3 failed with error:', error);
    throw "EventExtractKeyFromAttribute Test 3 failed";
}

export function EventParseProviderAddress(address: string): string {
    const pattern = /^lava@[a-z0-9]{39}$/;

    if (!pattern.test(address)) {
        throw new Error(`EventParseProviderAddress: Invalid provider address format: ${address}`);
    }

    return address;
}

export function EventParseInt(value: string): number {
    const pattern = /^\d+$/;

    if (!pattern.test(value)) {
        throw new Error(`EventParseInt: Value is not a valid integer: ${value}`);
    }

    const numberValue = parseInt(value, 10);
    if (numberValue > Number.MAX_SAFE_INTEGER) {
        throw new Error(`EventParseInt: Value is larger than the maximum safe integer: ${value}`);
    }

    return numberValue;
}

export function EventParseBigInt(value: string): bigint {
    const pattern = /^\d+$/;

    if (!pattern.test(value)) {
        throw new Error(`EventParseBigInt: Value is not a valid integer: ${value}`);
    }

    try {
        const bigIntValue = BigInt(value);
        return bigIntValue;
    } catch (error) {
        throw new Error(`EventParseBigInt: Error parsing value to BigInt: ${value}`);
    }
}

export function EventParseFloat(value: string): number {
    const pattern = /^-?\d*(\.\d+)?$/;

    if (!pattern.test(value)) {
        throw new Error(`EventParseFloat: Value is not a valid float: ${value}`);
    }

    return parseFloat(value);
}

export function EventParseAlphaNumericString(key: string): string {
    const pattern = /^[a-zA-Z0-9_-]{2,100}$/;

    if (!pattern.test(key)) {
        throw new Error(`EventParseAlphaNumericString: Key is not a valid alphanumeric string: ${key}`);
    }

    return key;
}

export function EventParseUlava(value: string): bigint {
    return ParseUlavaToBigInt(value);
}

export interface EventProcessAttributesProps {
    caller: string;
    lavaBlock: LavaBlock,
    evt: Event;
    height: number;
    txHash: string | null;
    dbEvent?: JsinfoSchema.InsertEvent | null,
    processAttribute?: (key: string, value: string) => void;
    verifyFunction?: (() => boolean) | null;
    skipKeys?: string[] | null;
}

export function EventProcessAttributes(
    {
        caller,
        lavaBlock,
        evt,
        height,
        txHash,
        dbEvent,
        processAttribute,
        verifyFunction = null,
        skipKeys = null,
    }: EventProcessAttributesProps
): boolean {

    let attributesDict: { [key: string]: string } = {};
    let keysCounter = 0;
    let errors: string[] = [];

    try {
        evt.attributes.forEach((attr: Attribute) => {
            keysCounter++;
            if (keysCounter > JSINFO_INDEXER_EVENT_ATTRIBUTE_KEY_COUNT_MAX) {
                console.log(`EventProcessAttributes: Too many keys: ${evt.attributes.length}`);
                return;
            }

            if (attr.key == "" || attr.value == "") return;
            if (attr.key.toLocaleLowerCase() == "<nil>" || attr.value == "<nil>") return;
            if (skipKeys && skipKeys.includes(attr.key)) return;

            let key = EventExtractKeyFromAttribute(attr);
            let value = attr.value;

            if (key.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) {
                key = key.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) + " ...";
            }

            if (value.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) {
                value = value.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) + " ...";
            }

            if (processAttribute) processAttribute(key, value);

            attributesDict[key] = value;
        })

    } catch (error) {
        let errorMessage = "An error occurred during evt.attributes processing. ";
        if (error instanceof Error) {
            errorMessage += error.message;
        } else {
            errorMessage += error + "";
        }
        errors.push(errorMessage);
    }

    if (errors.length === 0) {
        try {
            if (verifyFunction && !verifyFunction()) {
                errors.push("verifyFunction called and failed.");
            }
        } catch (error) {
            let errorMessage = "Error in verifyFunction. ";
            if (error instanceof Error) {
                errorMessage += error.message;
            } else {
                errorMessage += error + "";
            }
            errors.push(errorMessage);
        }
    }

    try {
        // console.log("dbEvent dbEvent dbEvent attributesDict", attributesDict);
        if (dbEvent) {
            dbEvent.fulltext = JSONStringify(attributesDict).substring(0, 10000);
        }
    } catch (error) {
        errors.push("Error in dbEvent fulltext stringify: " + JSONStringify(error));
    }

    if (dbEvent) dbEvent.timestamp = new Date(lavaBlock.datetime);

    if (errors.length === 0) return true;

    if (dbEvent && !dbEvent.fulltext) {
        try {
            dbEvent.fulltext = JSONStringify(evt).substring(0, 10000);
        } catch (error) {
            dbEvent.fulltext = (evt + "").substring(0, 10000);
        }
    }

    console.warn(`
        EventProcessAttributes processAttribute error.
        Caller: ${caller}
        ${(errors.join(" ") + "").substring(0, 0x1000)}
        Height: ${height.toString().substring(0, 0x1000)}
        TxHash: ${txHash?.substring(0, 0x1000)}
        Event: ${JSONStringify(evt).substring(0, 0x1000)}
    `);

    ParseEventError(evt, height, txHash, lavaBlock, errors.join(" "), caller);
    return false;
}