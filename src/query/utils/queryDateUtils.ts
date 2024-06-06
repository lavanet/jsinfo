// ./src/query/utils/dateUtils.ts

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
    date: string;
}

export function FormatDateItems<T extends DictWithDate>(data: T[]): T[] {
    const uniqueYears = new Set(data.map(item => new Date(item.date).getFullYear()));
    const addYears = uniqueYears.size > 1;

    return data.map(item => {
        return {
            ...item,
            date: FormatDateItem(new Date(item.date), addYears)
        };
    });
}