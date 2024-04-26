// jsinfo/src/indexer/eventUtils.ts

import { Event, Attribute } from "@cosmjs/stargate"
import { JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH } from './indexerConsts';
import { ParseEventError } from "./events/EventError";
import { LavaBlock } from "./types";

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
    console.error('EventExtractKeyFromAttribute Test 1 failed: Expected an error for key length less than 2');
} catch (error) {
}

// Test 2: Key does not contain a dot
try {
    const result = EventExtractKeyFromAttribute({ key: 'testKey', value: "" });
    if (result !== 'testKey') {
        console.error('EventExtractKeyFromAttribute Test 2 failed: Expected "testKey", got', result);
    } else {
    }
} catch (error) {
    console.error('EventExtractKeyFromAttribute Test 2 failed with error:', error);
    throw "EventExtractKeyFromAttribute Test 2 failed";
}

// Test 3: Key contains a dot
try {
    const result = EventExtractKeyFromAttribute({ key: 'test.key', value: "" });
    if (result !== 'test') {
        console.error('EventExtractKeyFromAttribute Test 3 failed: Expected "test", got', result);
    } else {
    }
} catch (error) {
    console.error('EventExtractKeyFromAttribute Test 3 failed with error:', error);
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

    return parseInt(value, 10);
}

export function EventParseFloat(value: string): number {
    const pattern = /^-?\d*(\.\d+)?$/;

    if (!pattern.test(value)) {
        throw new Error(`EventParseFloat: Value is not a valid float: ${value}`);
    }

    return parseFloat(value);
}

export function EventParseUlava(value: string): number {
    const ulavaIndex = value.indexOf('ulava');
    if (ulavaIndex === -1) {
        throw new Error(`ParseUlavaToInt: Value does not contain 'ulava': ${value}`);
    }

    const numberPart = value.substring(0, ulavaIndex);

    // Check if the string only contains numeric characters
    if (!/^\d+$/.test(numberPart)) {
        throw new Error(`ParseUlavaToInt: Value is not a valid integer: ${value}`);
    }

    const parsedNumber = parseInt(numberPart);

    if (isNaN(parsedNumber)) {
        throw new Error(`ParseUlavaToInt: Value is not a parsable number: ${value}`);
    }

    return parsedNumber;
}

export interface EventProcessAttributesProps {
    evt: Event;
    height: number;
    txHash: string | null;
    processAttribute: (key: string, value: string) => void;
    verifyFunction?: (() => boolean) | null;
    skipKeys?: string[] | null;
}

export function EventProcessAttributes(
    lavaBlock: LavaBlock,
    caller: string,
    {
        evt,
        height,
        txHash,
        processAttribute,
        verifyFunction = null,
        skipKeys = null,
    }: EventProcessAttributesProps
): boolean {

    try {
        evt.attributes.forEach((attr: Attribute) => {
            if (attr.key == "" || attr.value == "") return;
            if (attr.key.toLocaleLowerCase() == "<nil>" || attr.value == "<nil>") return;
            if (skipKeys && skipKeys.includes(attr.key)) return;

            if (attr.key.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH || attr.value.length > JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH) {
                const trimmedKey = attr.key.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH);
                const trimmedValue = attr.value.substring(0, JSINFO_INDEXER_EVENT_ATTRIBUTE_VALUE_MAX_LENGTH);
                throw new Error(`Key or value is too long. Trimmed key: ${trimmedKey}, Trimmed value: ${trimmedValue}`);
            }

            processAttribute(EventExtractKeyFromAttribute(attr), attr.value);
        })
    } catch (error) {
        console.warn(`
            EventProcessAttributes processAttribute error.
            Caller: ${caller}
            ${(error + "").substring(0, 0x1000)}
            Height: ${height.toString().substring(0, 0x1000)}
            TxHash: ${txHash?.substring(0, 0x1000)}
            Event: ${JSON.stringify(evt).substring(0, 0x1000)}
        `);

        ParseEventError(evt, height, txHash, lavaBlock, error, caller);
        return false;
    }

    try {
        if (verifyFunction && !verifyFunction()) {
            console.warn(`
                EventProcessAttributes verifyFunction failed.
                Caller: ${caller}
                VerifyFunction: ${verifyFunction.toString()}
                Height: ${height.toString().substring(0, 0x1000)}
                TxHash: ${txHash?.substring(0, 0x1000)}
                Event: ${JSON.stringify(evt).substring(0, 0x1000)}
            `);
            ParseEventError(evt, height, txHash, lavaBlock, "verifyFunctionFailed", caller);
            return false;
        }
    } catch (error) {
        console.warn(`
            EventProcessAttributes verifyFunction error.
            Caller: ${caller}
            ${(error + "").substring(0, 0x1000)}
            VerifyFunction: ${verifyFunction?.toString()}
            Height: ${height.toString().substring(0, 0x1000)}
            TxHash: ${txHash?.substring(0, 0x1000)}
            Event: ${JSON.stringify(evt).substring(0, 0x1000)}
        `);
        ParseEventError(evt, height, txHash, lavaBlock, error, caller);
        return false;
    }

    return true;
}