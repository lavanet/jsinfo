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