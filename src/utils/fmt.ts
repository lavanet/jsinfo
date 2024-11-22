// jsinfo/src/query/utils/queryUtils.ts

export function CSVEscape(str: string): string {
    return `"${str.replace(/"/g, '""')}"`;
}

export function GetDataLengthForPrints(data: any): string {
    if (data == null) return '<null>';
    if (Array.isArray(data)) {
        return String(data.length);
    } else if (typeof data === 'object' && data !== null) {
        return String(Object.keys(data).length);
    }
    return 'N/A';
}

export function GetDataLength(data: any): number {
    if (data == null) return 0;
    if (Array.isArray(data)) {
        return data.length;
    } else if (typeof data === 'object' && data !== null) {
        return Object.keys(data).length;
    }
    return 0;
}

export function GetTypeAsString(obj: any): string {
    return Object.prototype.toString.call(obj).replace(/^\[object\s|\]$/g, '');
}

export function JSONStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
    );
}

export function JSONStringifySpaced(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2
    );
}

export const IsMeaningfulText = (text: string | null | undefined): boolean => {
    if (!text) {
        return false;
    }

    const trimmedText = text.trim();
    if (trimmedText === '') {
        return false;
    }

    const trimmedTextLower = trimmedText.toLowerCase();
    const meaninglessValues = ['null', 'undefined', 'none', 'n/a', 'na', 'nil', 'false', '0'];
    if (meaninglessValues.includes(trimmedTextLower)) {
        return false
    }

    return true;
};

export function TruncateText(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
};

export function TruncateError(error: any): string {
    const errorString = error instanceof Error ? error.stack || error.message : String(error);
    return errorString.length > 1000 ? errorString.substring(0, 997) + '...' : errorString;
}

export function StringifyJsonForCompare(data: any): string {
    if (data === null) {
        return "null";
    }

    if (typeof data === "number" && data === 0) {
        return "0";
    }

    if (typeof data === "object") {
        // Remove 'block_report' key if it exists
        if (Array.isArray(data)) {
            data = data.map(item => typeof item === 'object' ? RemoveKeyFromJson(item, 'block_report') : item);
        } else {
            data = RemoveKeyFromJson(data, 'block_report');
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

export function RemoveKeyFromJson(obj: any, keyToRemove: string): any {
    if (Array.isArray(obj)) {
        return obj.map(item => RemoveKeyFromJson(item, keyToRemove));
    }

    if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            if (key !== keyToRemove) {
                acc[key] = RemoveKeyFromJson(obj[key], keyToRemove);
            }
            return acc;
        }, {} as any);
    }

    return obj;
}

export function MaskPassword(url: string): string {
    try {
        const masked = new URL(url);
        if (masked.password) {
            masked.password = '****';
        }
        return masked.toString().replace(/(\w+:\/\/\w+:)[^@]+(@)/, '$1****$2');
    } catch {
        return url.replace(/(\w+:\/\/\w+:)[^@]+(@)/, '$1****$2');
    }
}

export function HashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

export function HashJson(json: any): number {
    const jsonString = JSON.stringify(json);
    let hash = 0;
    for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}