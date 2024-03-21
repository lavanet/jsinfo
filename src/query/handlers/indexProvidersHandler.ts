// src/query/handlers/indexProvidersHandler.ts

import { FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify';
import { CheckReadDbInstance, GetReadDbInstance } from '../queryDb';
import * as schema from '../../schema';
import { sql, desc, inArray, not, eq } from "drizzle-orm";
import { Pagination, ParsePaginationFromRequest, ParsePaginationFromString } from '../queryPagination';
import { JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE } from '../queryConsts';

export const IndexProviderHandlerOpts: RouteShorthandOptions = {
    schema: {
        response: {
            200: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        addr: {
                            type: 'string'
                        },
                        moniker: {
                            type: 'string'
                        },
                        rewardSum: {
                            type: ['number', 'null', 'string']
                        },
                        totalServices: {
                            type: 'string'
                        },
                        totalStake: {
                            type: ['number', 'string']
                        }
                    }
                }
            }
        }
    }
}

export async function IndexProvidersHandler(request: FastifyRequest, reply: FastifyReply) {

    await CheckReadDbInstance()

    //
    // Get "top" providers
    let res4 = await GetReadDbInstance().select({
        address: schema.aggHourlyrelayPayments.provider,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        groupBy(schema.aggHourlyrelayPayments.provider).
        orderBy(desc(sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`))
    let providersAddrs: string[] = []
    res4.map((provider) => {
        providersAddrs.push(provider.address!)
    })

    if (providersAddrs.length == 0) {
        reply.code(400).send({ error: 'Providers does not exist' });
        return;
    }

    //
    // provider details
    let res44 = await GetReadDbInstance().select().from(schema.providers).where(inArray(schema.providers.address, providersAddrs))
    let providerStakesRes = await GetReadDbInstance().select({
        provider: schema.providerStakes.provider,
        totalActiveServices: sql<number>`sum(case when ${schema.providerStakes.status} = ${schema.LavaProviderStakeStatus.Active} then 1 else 0 end)`,
        totalServices: sql<number>`count(${schema.providerStakes.specId})`,
        totalStake: sql<number>`sum(${schema.providerStakes.stake})`,
    }).from(schema.providerStakes)
        .where(not(eq(schema.providerStakes.status, schema.LavaProviderStakeStatus.Frozen)))
        .groupBy(schema.providerStakes.provider);

    type ProviderDetails = {
        addr: string,
        moniker: string,
        rewardSum: number,
        totalServices: string,
        totalStake: number,
    };
    let providersDetails: ProviderDetails[] = []
    res4.forEach((provider) => {
        let moniker = ''
        let totalServices = '0'
        let totalStake = 0;
        let tmp1 = res44.find((el) => el.address == provider.address)
        if (tmp1) {
            moniker = tmp1.moniker!
        }
        let tmp2 = providerStakesRes.find((el) => el.provider == provider.address)
        if (tmp2) {
            totalServices = `${tmp2.totalActiveServices} / ${tmp2.totalServices}`
            totalStake = tmp2.totalStake
        }
        providersDetails.push({
            addr: provider.address!,
            moniker: moniker,
            rewardSum: provider.rewardSum,
            totalServices: totalServices,
            totalStake: totalStake,
        })
    })

    let pagination: Pagination = ParsePaginationFromRequest(request) || ParsePaginationFromString("totalStake,descending,1," + JSINFO_QUERY_DEFAULT_ITEMS_PER_PAGE);
    if (pagination.sortKey === null) pagination.sortKey = "totalStake";

    // Validate sortKey
    const validKeys = ["moniker", "addr", "rewardSum", "totalServices", "totalStake"];
    if (!validKeys.includes(pagination.sortKey)) {
        reply.code(400).send({ error: 'Invalid sort key' });
        return;
    }

    // Sort providersDetails
    providersDetails = providersDetails.sort((a, b) => {
        if (a[pagination.sortKey!] < b[pagination.sortKey!]) {
            return pagination.direction === 'ascending' ? -1 : 1;
        }
        if (a[pagination.sortKey!] > b[pagination.sortKey!]) {
            return pagination.direction === 'ascending' ? 1 : -1;
        }
        return 0;
    });

    // Apply page and count
    const start = (pagination.page - 1) * pagination.count;
    const end = start + pagination.count;
    providersDetails = providersDetails.slice(start, end);

    return providersDetails;
}

export async function IndexProvidersItemCountHandler(request: FastifyRequest, reply: FastifyReply) {
    await CheckReadDbInstance()

    //
    // Get "top" providers
    let res4 = await GetReadDbInstance().select({
        address: schema.aggHourlyrelayPayments.provider,
        rewardSum: sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`,
    }).from(schema.aggHourlyrelayPayments).
        groupBy(schema.aggHourlyrelayPayments.provider).
        orderBy(desc(sql<number>`sum(${schema.aggHourlyrelayPayments.rewardSum})`))
    let providersAddrs: string[] = []
    res4.map((provider) => {
        providersAddrs.push(provider.address!)
    })

    if (providersAddrs.length == 0) {
        reply.code(400).send({ error: 'Providers does not exist' });
        return;
    }
    return { itemCount: providersAddrs.length };
}