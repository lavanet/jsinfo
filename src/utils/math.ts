export function avg(numbers: number[]): number {
    return numbers.length ? numbers.reduce((a, b) => a + b) / numbers.length : 0;
}