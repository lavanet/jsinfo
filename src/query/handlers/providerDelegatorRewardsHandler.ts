
// src/query/handlers/providerDelegatorRewardsHandler.ts

// curl http://localhost:8081/providerDelegatorRewards/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { eq, desc, gt, and, sql, asc } from "drizzle-orm";
import { Pagination, ParsePaginationFromString } from '../utils/queryPagination';
import { GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import * as JsinfoSchema from '../../schemas/jsinfoSchema/jsinfoSchema';
import { RequestHandlerBase } from '../classes/RequestHandlerBase';

export interface DelegatorRewardResponse {
    id: number;
    timestamp: string;
    chainId: string;
    amount: string;
}

export const ProviderDelegatorRewardsPaginatedHandlerOpts: RouteShorthandOptions = {
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
                                id: { type: ['string', 'number'] },
                                timestamp: { type: 'string' },
                                chainId: { type: 'string' },
                                amount: { type: 'string' },
                            }
                        }
                    }
                }
            }
        }
    }
}

class ProviderDelegatorRewardsData extends RequestHandlerBase<DelegatorRewardResponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderDelegatorRewardsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderDelegatorRewardsData {
        return ProviderDelegatorRewardsData.GetInstanceBase(addr);
    }

    protected getCSVFileName(): string {
        return `ProviderDelegatorRewards_${this.addr}.csv`;
    }

    protected async fetchAllRecords(): Promise<DelegatorRewardResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const result = await QueryGetJsinfoReadDbInstance().select({
            id: JsinfoSchema.dualStackingDelegatorRewards.id,
            timestamp: JsinfoSchema.dualStackingDelegatorRewards.timestamp,
            chainId: JsinfoSchema.dualStackingDelegatorRewards.chainId,
            amount: sql<string>`(${JsinfoSchema.dualStackingDelegatorRewards.amount} || ' ' || ${JsinfoSchema.dualStackingDelegatorRewards.denom})`
        })
            .from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr))
            .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION);

        return result.map(row => ({
            id: row.id,
            timestamp: row.timestamp ? row.timestamp.toISOString() : "",
            chainId: row.chainId,
            amount: row.amount
        }));
    }

    protected async fetchRecordCountFromDb(): Promise<number> {
        await QueryCheckJsinfoReadDbInstance();

        const countResult = await QueryGetJsinfoReadDbInstance()
            .select({
                count: sql<number>`COUNT(*)`
            })
            .from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr));

        return Math.min(countResult[0].count || 0, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION - 1);
    }

    public async fetchPaginatedRecords(pagination: Pagination | null): Promise<DelegatorRewardResponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        // Set default pagination if not provided
        if (!pagination) {
            pagination = ParsePaginationFromString("id,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        const keyToColumnMap = {
            id: JsinfoSchema.dualStackingDelegatorRewards.id,
            timestamp: JsinfoSchema.dualStackingDelegatorRewards.timestamp,
            chain_id: JsinfoSchema.dualStackingDelegatorRewards.chainId,
            amount: sql<string>`(${JsinfoSchema.dualStackingDelegatorRewards.amount} || ' ' || ${JsinfoSchema.dualStackingDelegatorRewards.denom})`
        };

        const sortKey = pagination.sortKey && Object.keys(keyToColumnMap).includes(pagination.sortKey) ? pagination.sortKey : "timestamp";
        const sortColumn = keyToColumnMap[sortKey];
        const orderFunction = pagination.direction === 'ascending' ? asc : desc;

        const offset = (pagination.page - 1) * pagination.count;

        const result = await QueryGetJsinfoReadDbInstance().select({
            id: JsinfoSchema.dualStackingDelegatorRewards.id,
            timestamp: JsinfoSchema.dualStackingDelegatorRewards.timestamp,
            chainId: JsinfoSchema.dualStackingDelegatorRewards.chainId,
            amount: sql<string>`(${JsinfoSchema.dualStackingDelegatorRewards.amount} || ' ' || ${JsinfoSchema.dualStackingDelegatorRewards.denom})`
        })
            .from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr))
            .orderBy(orderFunction(sortColumn))
            .offset(offset)
            .limit(pagination.count);

        return result.map(row => ({
            id: row.id,
            timestamp: row.timestamp ? row.timestamp.toISOString() : "",
            chainId: row.chainId,
            amount: row.amount
        }));
    }


    protected async convertRecordsToCsv(data: DelegatorRewardResponse[]): Promise<string> {
        let csv = 'time,chain,amount\n';
        data.forEach((item: DelegatorRewardResponse) => {
            csv += `${item.timestamp},${item.chainId},${item.amount}\n`;
        });
        return csv;
    }
}

export async function ProviderDelegatorRewardsPaginatedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).PaginatedRecordsRequestHandler(request, reply)
}

export async function ProviderDelegatorRewardsItemCountPaginatiedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).getTotalItemCountPaginatedHandler(request, reply)
}

export async function ProviderDelegatorRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).CSVRequestHandler(request, reply)
}