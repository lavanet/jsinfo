
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

