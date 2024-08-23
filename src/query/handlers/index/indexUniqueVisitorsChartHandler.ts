// src/query/handlers/indexUniqueVisitorsChartsHandler.ts

import { FastifyReply, FastifyRequest, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../../queryDb';
import * as JsinfoSchema from '../../../schemas/jsinfoSchema/jsinfoSchema';
import { sql, desc, gt } from "drizzle-orm";
import { DateToDayDateString, FormatDateItems } from '../../utils/queryDateUtils';

interface UniqueVisitorsData {
    date: string;
    uniqueVisitors: number | null;
}

export const IndexUniqueVisitorsChartRawHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'object',
                properties: {
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                uniqueVisitors: { type: 'number' },
                            }
                        }
                    }
                }
            }
        }
    }
};

async function fetchVisitorsData(): Promise<UniqueVisitorsData[]> {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 30);

    let ret = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.uniqueVisitors)
        .orderBy(desc(JsinfoSchema.uniqueVisitors.id))
        .where(gt(JsinfoSchema.uniqueVisitors.timestamp, sql<Date>`${from}`));

    return ret.map((row: JsinfoSchema.UniqueVisitors) => ({
        date: DateToDayDateString(row.timestamp),
        uniqueVisitors: row.value ?? 0,
    }));
}

export async function IndexUniqueVisitorsChartRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let ret: UniqueVisitorsData[] = await fetchVisitorsData();

    // it's cache of an hour - make sure we are fetching data
    if (ret == null || ret.length === 0) {
        ret = await fetchVisitorsData();
        if (ret == null || ret.length === 0) {
            return null;
        }
    }

    let formattedData: UniqueVisitorsData[] = FormatDateItems<UniqueVisitorsData>(ret);

    return { data: formattedData };
}