export function avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((a, b) => a + parseFloat(String(b)), 0);
    return parseFloat((sum / arr.length).toFixed(9)); // Keep 9 decimal places
}