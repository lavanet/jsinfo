import { FastifyRequest } from "fastify";
import * as url from 'url';
import { JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE } from "./queryConsts";

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

    if (JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE != 0 && JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE && Number(count) != JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE) {
        console.error(`validatePaginationString:: Invalid count: ${count} in ${paginationString}. Count must be : ${JSINFO_QUERY_ALLOWED_ITEMS_PER_PAGE}`);
        return false;
    }

    return true;
}

export function ParsePaginationFromString(paginationString: string): Pagination {
    let parts = paginationString.split(',');

    if (parts.length === 3) {
        parts = parsePaginationStringHandleThreeParts(parts);
    }

    if (parts.length !== 4) {
        const error = new Error(`Invalid format: the string must have exactly two or three commas. Received: ${paginationString}`);
        console.error(`Error parsing pagination string: ${paginationString}`);
        console.error(error);
        throw error;
    }

    const [sortKey, direction, page, itemCountPerPage] = parts;

    if (!sortKey || !['a', 'asc', 'ascending', 'd', 'desc', 'descending'].includes(direction) || isNaN(Number(page)) || isNaN(Number(itemCountPerPage))) {
        const error = new Error(`Invalid format: the string must be in the format <sortKey>,<direction>,<page>,<itemCountPerPage>. Received: ${paginationString}`);
        console.error(`Error parsing pagination string: ${paginationString}`);
        console.error(error);
        throw error;
    }

    let finalDirection = parsePaginationStringGetFinalDirection(direction);

    return {
        sortKey: sortKey === '-' ? null : sortKey,
        direction: finalDirection,
        page: parseInt(page, 10),
        count: parseInt(itemCountPerPage, 10)
    };
}

function parsePaginationStringHandleThreeParts(parts: string[]): string[] {
    let sortKeyParts = parts[0].split('|');
    if (sortKeyParts.length === 2 && ['a', 'asc', 'ascending', 'd', 'desc', 'descending'].includes(sortKeyParts[1])) {
        return [sortKeyParts[0], sortKeyParts[1], ...parts.slice(1)];
    } else {
        return [sortKeyParts[0], 'a', ...parts.slice(1)];
    }
}

function parsePaginationStringGetFinalDirection(direction: string): "ascending" | "descending" {
    switch (direction) {
        case 'a':
        case 'asc':
        case 'ascending':
            return 'ascending';
        case 'd':
        case 'desc':
        case 'descending':
            return 'descending';
        default:
            throw new Error(`Invalid direction: ${direction}. Expected 'a', 'asc', 'ascending', 'd', 'desc', or 'descending'`);
    }
}

export function ParsePaginationFromRequest(request: FastifyRequest): Pagination | null {
    try {
        const parsedUrl = url.parse(request.url, true);
        const serializedPagination = parsedUrl.query.pagination;

        if (!serializedPagination || typeof serializedPagination !== 'string' || !validatePaginationString(serializedPagination)) {
            return null;
        }

        return ParsePaginationFromString(serializedPagination);

    } catch (error) {
        console.log('Failed to parse pagination from request:', error);
        return null;
    }
}

export function SerializePagination(pagination: Pagination): string {
    const { sortKey, direction, page, count } = pagination;
    const directionShort = direction === 'ascending' ? 'a' : 'd';
    const sortKeyString = sortKey === null ? '-' : sortKey;

    return `${sortKeyString},${directionShort},${page},${count}`;
}
