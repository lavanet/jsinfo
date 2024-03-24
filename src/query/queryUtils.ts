export function CompareValues(aValue: string | number, bValue: string | number, direction: 'ascending' | 'descending') {
    // Check if direction is 'ascending' or 'descending'
    if (direction !== 'ascending' && direction !== 'descending') {
        throw new Error('Invalid direction. Direction must be either "ascending" or "descending".');
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

export const IsNotNullAndNotZero = (value: number | null) => value !== null && value !== 0;