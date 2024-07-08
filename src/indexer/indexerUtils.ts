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
    return str.replace(/(archive,)+archive/g, "archive").replace(/archivearchive/g, "archive");
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
