// jsinfo/src/query/utils/queryUtils.ts

export function CompareValues(aValue: string | number | null, bValue: string | number | null, direction: 'ascending' | 'descending') {
    // Check if direction is 'ascending' or 'descending'
    if (direction !== 'ascending' && direction !== 'descending') {
        throw new Error('Invalid direction. Direction must be either "ascending" or "descending".');
    }

    // Handle null values
    if (aValue === null && bValue === null) {
        return 0;
    } else if (aValue === null) {
        return direction === 'ascending' ? -1 : 1;
    } else if (bValue === null) {
        return direction === 'ascending' ? 1 : -1;
    }

    // Convert to number if both values are numeric
    if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
        aValue = Number(aValue);
        bValue = Number(bValue);
    }

    if (direction === 'ascending') {
        return aValue > bValue ? 1 : -1;
    } else {
        return aValue < bValue ? 1 : -1;
    }
}

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
