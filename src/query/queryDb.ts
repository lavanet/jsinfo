// src/query/queryDb.ts

import { IsIndexerProcess, logger } from '../utils/utils';

import { GetJsinfoDbForQuery, GetRelaysReadDbForQuery } from '../utils/dbUtils';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { desc } from "drizzle-orm";
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import * as RelaysSchema from '../schemas/relaysSchema';

let db: PostgresJsDatabase | null = null;
let relaysReadDb: PostgresJsDatabase | null = null;

export async function QueryCheckIsJsinfoDbInstanceOk() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    try {
        await db!.select().from(JsinfoSchema.blocks).limit(1)
        return true
    } catch (e) {
        return false
    }
}

export async function QueryCheckJsinfoDbInstance() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    try {
        await db!.select().from(JsinfoSchema.blocks).limit(1)
    } catch (e) {
        logger.info('QueryCheckJsinfoDbInstance exception, resetting connection')
        logger.error('Exception details:', e)
        if (e instanceof Error) {
            console.error('Exception stack trace:', e.stack || "");
        }
        db = await GetJsinfoDbForQuery()
    }
}

export function QueryGetJsinfoDbForQueryInstance(): PostgresJsDatabase {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    if (!db) {
        throw new Error('Jsinfo database instance is not initialized');
    }
    return db;
}

export async function QueryInitJsinfoDbInstance() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    logger.info('Starting queryserver - connecting to jsinfoDb')
    db = db || await GetJsinfoDbForQuery();
}

export async function QueryCheckRelaysReadDbInstance() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    try {
        await relaysReadDb!.select().from(RelaysSchema.lavaReportError).limit(1)
    } catch (e) {
        logger.info('QueryCheckJsinfoDbInstance exception, resetting connection', e)
        relaysReadDb = await GetRelaysReadDbForQuery()
    }
}

export async function QueryInitRelaysReadDbInstance() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    logger.info('Starting queryserver - connecting to relaysReadDb')
    relaysReadDb = relaysReadDb || await GetRelaysReadDbForQuery();
}

export function QueryGetRelaysReadDbForQueryInstance(): PostgresJsDatabase {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    if (!relaysReadDb) {
        throw new Error('relaysReadDb database instance is not initialized');
    }
    return relaysReadDb;
}

export async function GetLatestBlock() {
    if (IsIndexerProcess()) {
        throw new Error('Query/queryDb.ts should not be used in the indexer');
    }

    const latestDbBlocks = await QueryGetJsinfoDbForQueryInstance().select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1)
    let latestHeight = 0
    let latestDatetime = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
        latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
    }
    return { latestHeight, latestDatetime }
}