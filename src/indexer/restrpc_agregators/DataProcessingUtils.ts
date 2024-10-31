
export function ReplaceForCompare(data: any): string {
    if (data === null) {
        return "null";
    }

    if (typeof data === "number" && data === 0) {
        return "0";
    }

    if (typeof data === "object") {
        // Remove 'block_report' key if it exists
        if (Array.isArray(data)) {
            data = data.map(item => typeof item === 'object' ? RemoveKey(item, 'block_report') : item);
        } else {
            data = RemoveKey(data, 'block_report');
        }
        data = JSON.stringify(data);
    }

    if (typeof data !== "string") {
        data = String(data);
    }

    return data.toLowerCase()
        .replace(/\s+/g, '')
        .replace(/\t/g, '')
        .replace(/\n/g, '');
}

export function RemoveKey(obj: any, keyToRemove: string): any {
    if (Array.isArray(obj)) {
        return obj.map(item => RemoveKey(item, keyToRemove));
    }

    if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            if (key !== keyToRemove) {
                acc[key] = RemoveKey(obj[key], keyToRemove);
            }
            return acc;
        }, {} as any);
    }

    return obj;
}

export function CalculatePercentile(values: number[], rank: number): number {
    const dataLen = values.length;
    if (dataLen === 0 || rank < 0.0 || rank > 1.0) {
        return 0;
    }

    // Sort values in ascending order
    values.sort((a, b) => a - b);

    // Calculate the position based on the rank
    const position = Math.floor((dataLen - 1) * rank);

    if (dataLen % 2 === 0) {
        // Interpolate between two middle values
        const lower = values[position];
        const upper = values[position + 1];
        return lower + (upper - lower) * rank;
    } else {
        return values[position];
    }
}
