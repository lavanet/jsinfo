// ./src/query/utils/dateUtils.ts

import { parseISO } from 'date-fns';

export function FormatDates(dataArray) {
    if (!dataArray || dataArray === '' || Array.isArray(dataArray) && dataArray.length === 0 || typeof dataArray === 'object' && Object.keys(dataArray).length === 0) {
        return [];
    }
    return dataArray.map(item => {
        const date = new Date(item.date);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedDate = `${date.getDate()}${monthNames[date.getMonth()]}`;
        return {
            ...item,
            date: formattedDate
        };
    });
}

export function FormatDateItem(date: Date, addYears: boolean = false): string {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let formattedDate = `${date.getDate()}${monthNames[date.getMonth()]}`;

    if (addYears) {
        formattedDate += `${date.getFullYear().toString().slice(-2)}`;
    }

    return formattedDate;
}

interface DictWithDate {
    date: string | null;
}

export function FormatDateItems<T extends DictWithDate>(data: T[]): T[] {
    const uniqueYears = new Set(data.map(item => {
        if (item.date === null) throw new Error("Item date is null.");
        return ParseDateToUtc(item.date).getFullYear();
    }));
    const addYears = uniqueYears.size > 1;

    return data.map(item => {
        if (item.date === null) throw new Error("Item date is null.");
        return {
            ...item,
            date: FormatDateItem(ParseDateToUtc(item.date), addYears)
        };
    });
}

export function ParseDateToUtc(dt: string | number): Date {
    let date: Date;

    if (typeof dt === 'number') {
        // Convert Unix timestamp to milliseconds and create a Date object for number type
        date = new Date(dt * 1000);
    } else if (typeof dt === 'string' && /^\d+$/.test(dt)) {
        // Convert Unix timestamp to milliseconds and create a Date object for string type
        date = new Date(parseInt(dt, 10) * 1000);
    } else if (typeof dt === 'string') {
        // Parse ISO string to Date
        date = parseISO(dt);
    } else {
        throw new Error('Unsupported date type');
    }

    // Convert to UTC by creating a new Date object using the UTC values from the original date
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
}

export function DateToISOString(date: Date | string | null): string {
    const dateString = (date + "").toLowerCase();
    if (!date || ["null", "0", "undefined", "nan", ""].includes(dateString)) {
        throw new Error("Invalid date value: " + date);
    }
    return new Date(date).toISOString();
}

export function DateToDayDateString(date: Date | string | null): string {
    const dateString = (date + "").toLowerCase();
    if (!date || ["null", "0", "undefined", "nan", ""].includes(dateString)) {
        throw new Error("Invalid date value: " + date);
    }
    if (typeof date === 'string') {
        date = new Date(date);
    }
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}