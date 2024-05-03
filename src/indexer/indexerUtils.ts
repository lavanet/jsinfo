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
    return str.replace(/(archive,)+archive/g, "archive");
}