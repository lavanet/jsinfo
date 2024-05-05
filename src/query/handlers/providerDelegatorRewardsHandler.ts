
// src/query/handlers/providerDelegatorRewardsHandler.ts

// curl http://localhost:8081/providerDelegatorRewards/lava@14shwrej05nrraem8mwsnlw50vrtefkajar75ge

import path from 'path';
import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { QueryGetJsinfoReadDbInstance } from '../queryDb';
import { eq, desc } from "drizzle-orm";
import { Pagination } from '../utils/queryPagination';
import { CompareValues, GetAndValidateProviderAddressFromRequest } from '../utils/queryUtils';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';
import * as JsinfoSchema from '../../schemas/jsinfo_schema';
import { CachedDiskPsqlQuery } from '../classes/CachedDiskPsqlQuery';

export interface DelegatorRewardReponse {
    id: number;
    timestamp: string;
    chainId: string;
    amount: string;
}

export const ProviderDelegatorRewardsHandlerOpts: RouteShorthandOptions = {
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

class ProviderDelegatorRewardsData extends CachedDiskPsqlQuery<DelegatorRewardReponse> {
    private addr: string;

    constructor(addr: string) {
        super();
        this.addr = addr;
    }

    protected getCacheFilePath(): string {
        return path.join(this.cacheDir, `ProviderDelegatorRewardsHandlerData_${this.addr}`);
    }

    protected async fetchDataFromDb(): Promise<DelegatorRewardReponse[]> {
        const result = await QueryGetJsinfoReadDbInstance().select().from(JsinfoSchema.dualStackingDelegatorRewards)
            .where(eq(JsinfoSchema.dualStackingDelegatorRewards.provider, this.addr))
            .orderBy(desc(JsinfoSchema.dualStackingDelegatorRewards.timestamp)).offset(0).limit(5000)

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

        // If slice would fail, return a [0,20] slice
        if (start < 0 || end < 0 || start > data.length || end > data.length) {
            return data.slice(0, JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
        }

        return data.slice(start, end);
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

export async function ProviderDelegatorRewardsItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    return providerDelegatorRewardsData.getTotalItemCount();;
}

export async function ProviderDelegatorRewardsHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    try {
        const data = await providerDelegatorRewardsData.getPaginatedItems(request);
        return data;
    } catch (error) {
        const err = error as Error;
        reply.code(400).send({ error: String(err.message) });
    }
}

export async function ProviderDelegatorRewardsCSVHandler(request: FastifyRequest, reply: FastifyReply) {
    let addr = await GetAndValidateProviderAddressFromRequest(request, reply);
    if (addr === '') {
        return;
    }

    const providerDelegatorRewardsData = new ProviderDelegatorRewardsData(addr);
    const csv = await providerDelegatorRewardsData.getCSV();

    if (csv === null) {
        return;
    }

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename=ProviderDelegatorRewards_${addr}.csv`);
    reply.send(csv);
}