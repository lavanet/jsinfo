// ./src/query/dateUtils.ts

export function FormatDates(dataArray) {
    if (!dataArray || dataArray === '' || Array.isArray(dataArray) && dataArray.length === 0 || typeof dataArray === 'object' && Object.keys(dataArray).length === 0) {
        return [];
    }
    return dataArray.map(item => {
        const date = new Date(item.date);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedDate = `${monthNames[date.getMonth()]} ${date.getDate()}`;
        return {
            ...item,
            date: formattedDate
        };
    });
}