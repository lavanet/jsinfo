export function MinBigInt(a: bigint | null, b: bigint | null): bigint {
    let aValue = a ?? 0n;
    let bValue = b ?? 0n;
    return aValue < bValue ? aValue : bValue;
}

export function BigIntIsZero(value: bigint | null): boolean {
    return value === null ? false : value === 0n;
}

export function ParseUlavaToBigInt(value: string): bigint {
    const claimedParts = value.split(',');

    // Iterate over each value to find 'ulava'
    let ulavaValue = '';
    for (const part of claimedParts) {
        if (part.includes('ulava')) {
            ulavaValue = part;
            break;
        }
    }

    if (ulavaValue === '') return 0n;

    const ulavaIndex = ulavaValue.indexOf('ulava');
    if (ulavaIndex === -1) {
        throw new Error(`ParseUlavaToBigInt: Value does not contain 'ulava': ${value}, ulavaValue: ${ulavaValue}`);
    }

    const numberPart = ulavaValue.substring(0, ulavaIndex);

    // Check if the string only contains numeric characters
    if (!/^\d+$/.test(numberPart)) {
        throw new Error(`ParseUlavaToBigInt: value is not a valid integer: ${value}, numberPart: ${numberPart}`);
    }

    return BigInt(numberPart);
}