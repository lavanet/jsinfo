import { FastifyRequest } from "fastify";
import * as url from 'url';

export interface Pagination {
    sortKey: string | null;
    direction: 'ascending' | 'descending';
    page: number;
    count: number;
}

export function validatePaginationString(paginationString: string): boolean {

    // Check if paginationString is not longer than 100 chars
    if (paginationString.length > 100) {
        console.error(`validatePaginationString:: Pagination string is too long: ${paginationString.substring(0, 100)}. It must not be longer than 100 characters.`);
        return false;
    }

    // Check if paginationString has 3 commas in it
    if ((paginationString.match(/,/g) || []).length !== 3) {
        console.error(`validatePaginationString:: Invalid format: ${paginationString}. It must contain exactly 3 commas.`);
        return false;
    }

    const [sortKey, direction, page, count] = paginationString.split(',');

    // Check if direction is either 'a' or 'd'
    if (direction !== 'a' && direction !== 'd') {
        console.error(`validatePaginationString:: Invalid direction: ${direction} in ${paginationString}. Direction must be either 'a' or 'd'.`);
        return false;
    }

    // Check if sortKey only contains alphanumeric characters, dots, slashes, or underscores
    const sortKeyRegex = /^[0-9a-zA-Z\._\-]+$/;
    if (!sortKeyRegex.test(sortKey)) {
        console.error(`validatePaginationString:: Invalid sortKey: ${sortKey} in ${paginationString}. SortKey must only contain alphanumeric characters, dots, slashes, or underscores.`);
        return false;
    }

    // Check if page is within 1 and 100 (including)
    if (isNaN(Number(page)) || Number(page) < 1 || Number(page) > 1000) {
        console.error(`validatePaginationString:: Invalid page: ${page} in ${paginationString}. Page must be a number between 1 and 1000 (including).`);
        return false;
    }

    // Check if count is within 1 and 100 (including)
    if (isNaN(Number(count)) || Number(count) < 1 || Number(count) > 100) {
        console.error(`validatePaginationString:: Invalid count: ${count} in ${paginationString}. Count must be a number between 1 and 100 (including).`);
        return false;
    }

    return true;
}

export function parsePagination(request: FastifyRequest): Pagination | null {
    try {
        const parsedUrl = url.parse(request.url, true);
        const serializedPagination = parsedUrl.query.pagination;

        if (!serializedPagination || typeof serializedPagination !== 'string' || !validatePaginationString(serializedPagination)) {
            return null;
        }

        const [sortKey, direction, page, count] = serializedPagination.split(',');

        return {
            sortKey: sortKey === '-' ? null : sortKey,
            direction: direction === 'a' ? 'ascending' : 'descending',
            page: parseInt(page, 10),
            count: parseInt(count, 10),
        };
    } catch (error) {
        console.log('Failed to parse pagination from request:', error);
        return null;
    }
}