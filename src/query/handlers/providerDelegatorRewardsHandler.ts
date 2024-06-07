
// src/query/handlers/providerDelegatorRewardsHandler.ts

// curl http://localhost:8081/providerDelegatorRewards/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge

import path from 'path';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryCheckJsinfoReadDbInstance, QueryGetJsinfoReadDbInstance } from '../queryDb';
import { eq, desc, gt, and } from "drizzle-orm";
import { Pagination } from '../utils/queryPagination';
import { CompareValues, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE, JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION } from '../queryConsts';
import * as JsinfoSchema from '../../schemas/jsinfoSchema';
import { CachedDiskDbDataFetcher } from '../classes/CachedDiskDbDataFetcher';

export interface DelegatorRewardReponse {
    id: number;
    timestamp: string;
    chainId: string;
    amount: string;
}

export const ProviderDelegatorRewardsCachedHandlerOpts: RouteShorthandOptions = {
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

class ProviderDelegatorRewardsData extends CachedDiskDbDataFetcher<DelegatorRewardReponse> {
    private addr: string;

    constructor(addr: string) {
        super("ProviderDelegatorRewardsData");
        this.addr = addr;
    }

    public static GetInstance(addr: string): ProviderDelegatorRewardsData {
        return ProviderDelegatorRewardsData.GetInstanceBase(addr);
    }

    protected getCSVFileNameImpl(): string {
        return `ProviderDelegatorRewards_${this.addr}.csv`;
    }

    protected getCacheFilePathImpl(): string {
        return path.join(this.cacheDir, `ProviderDelegatorRewardsHandlerData_${this.addr}`);
    }

    protected isSinceDBFetchEnabled(): boolean {
        return true;
    }

    protected sinceUniqueField(): string {
        return "id";
    }

    protected async fetchDataFromDb(): Promise<DelegatorRewardReponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr))
            .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return result.map((row: JsinfoSchema.DualStackingDelegatorRewards) => ({
            id: row.id,
            timestamp: row.timestamp?.toISOString(),
            chainId: row.chainId,
            amount: row.amount + " " + row.denom
        }));
    }

    protected async fetchDataFromDbSinceFlow(since: number | string): Promise<DelegatorRewardReponse[]> {
        await QueryCheckJsinfoReadDbInstance();

        const result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(and(
                eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr),
                gt(JsinfoSchema.dualStackingDelegatorRewards.id, Number(since))
            )
            )
            .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.id))
            .offset(0)
            .limit(JSINFO_QUERY_TOTAL_ITEM_LIMIT_FOR_PAGINATION)

        const highestId = result[0]?.id;
        if (highestId !== undefined) {
            this.setSince(highestId);
        }

        return result.map((row: JsinfoSchema.DualStackingDelegatorRewards) => ({
            id: row.id,
            timestamp: row.timestamp?.toISOString(),
            chainId: row.chainId,
            amount: row.amount + " " + row.denom
        }));
    }

    public async getPaginatedItemsImpl(data: DelegatorRewardReponse[], pagination: Pagination | null): Promise<DelegatorRewardReponse[] | null> {
        if (pagination == null) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        data = this.sortData(data, pagination.sortKey || "", pagination.direction);

        const start = (pagination.page - 1) * pagination.count;
        const end = start + pagination.count;

        return SafeSlice(data, start, end, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
    }

    private sortData(data: DelegatorRewardReponse[], sortKey: string, direction: 'ascending' | 'descending'): DelegatorRewardReponse[] {
        if (sortKey === "-" || sortKey === "") sortKey = "timestamp";

        if (sortKey && ["timestamp", "chain_id", "amount"].includes(sortKey)) {
            if (sortKey !== "timestamp" || direction !== "descending") {
                // default
            }
        } else {
            console.log(`Invalid sortKey: ${sortKey}`);
        }

        return data.sort((a, b) => {
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            return CompareValues(aValue, bValue, direction);
        });
    }

    public async getCSVImpl(data: DelegatorRewardReponse[]): Promise<string> {
        let csv = 'time,chainId,amount\n';
        data.forEach((item: DelegatorRewardReponse) => {
            csv += `${item.timestamp},${item.chainId},${item.amount}\n`;
        });
        return csv;
    }
}

export async function ProviderDelegatorRewardsCachedHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return null;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).getPaginatedItemsCachedHandler(request, reply)
}

export async function ProviderDelegatorRewardsItemCountRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).getTotalItemCountRawHandler(request, reply)
}

export async function ProviderDelegatorRewardsCSVRawHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return reply;
    }
    return await ProviderDelegatorRewardsData.GetInstance(addr).getCSVRawHandler(request, reply)
}