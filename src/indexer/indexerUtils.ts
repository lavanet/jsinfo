import Long from "long";

export function ParseSizeToBytes(input) {
    const units = input.toLowerCase().match(/^(\d+)([a-z]+)$/);
    if (!units) throw new Error("Invalid size format");

    const size = parseInt(units[1], 10);
    const unit = units[2];

    const sizes = {
        b: 1,
        kb: 1024,
        mb: 1024 * 1024,
        gb: 1024 * 1024 * 1024,
        tb: 1024 * 1024 * 1024 * 1024
    };

    if (!sizes[unit]) throw new Error("Unsupported size unit");

    return size * sizes[unit];
}

export function ReplaceArchive(str: string): string {
    let previous;
    do {
        previous = str;
        str = str.replace(/(archive,)+archive/g, "archive").replace(/archivearchive/g, "archive");
    } while (str !== previous);
    return str;
}

export function ToSignedIntOrMinusOne(input: bigint | number | string | Long | null): number {
    if (input === null) return 0;
    let num;
    if (["9223372036854776000", "2147483647", "-1"].some(maxValue => (input + "").includes(maxValue))) {
        return -1;
    }
    if (Long.isLong(input)) {
        num = input.toSigned().toInt();
    } else if (typeof input === 'bigint') {
        num = Number(input);
    } else if (typeof input === 'string') {
        num = parseInt(input, 10);
    } else {
        num = input;
    }
    return num >= 0 ? num : -num;
}

export function ToSignedBigIntOrMinusOne(input: bigint | number | string | Long | null): bigint {
    if (input === null) return BigInt(0);
    let num: bigint;
    if (["9223372036854776000", "2147483647", "-1"].some(maxValue => (input + "").includes(maxValue))) {
        return BigInt(-1);
    }
    if (Long.isLong(input)) {
        num = BigInt(input.toSigned().toString());
    } else if (typeof input === 'bigint') {
        num = input;
    } else if (typeof input === 'string') {
        num = BigInt(input);
    } else {
        num = BigInt(input);
    }
    return num >= BigInt(0) ? num : -num;
}

export function AppendUniqueItems(currentItems: string[], itemsToAdd: string[]): string[] {
    return Array.from(new Set([...currentItems, ...itemsToAdd]));
}