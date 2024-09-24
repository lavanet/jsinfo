// src/query/queryDb.ts

import { logger } from '../utils/utils';
import { GetJsinfoDb, GetJsinfoReadDb, GetRelaysReadDb } from '../utils/dbUtils';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { JSINFO_NO_READ_DB } from './queryConsts';
import * as JsinfoSchema from '../schemas/jsinfoSchema/jsinfoSchema';
import * as RelaysSchema from '../schemas/relaysSchema';

let db: PostgresJsDatabase | null = null;
let readDb: PostgresJsDatabase | null = null;
let relaysReadDb: PostgresJsDatabase | null = null;

export async function QueryCheckJsinfoDbInstance() {
    try {
        await db!.select().from(JsinfoSchema.latestblock).limit(1)
    } catch (e) {
        logger.info('QueryCheckJsinfoDbInstance exception, resetting connection')
        db = await GetJsinfoDb()
    }
}

export async function QueryCheckIsJsinfoDbInstanceOk() {
    try {
        await db!.select().from(JsinfoSchema.latestblock).limit(1)
        return true
    } catch (e) {
        return false;
    }
}

export async function QueryInitJsinfoDbInstance() {
    logger.info('Starting queryserver - connecting to jsinfo db')
    db = db || await GetJsinfoDb();
}

export function QueryGetJsinfoDbInstance(): PostgresJsDatabase {
    if (!db) {
        throw new Error('Database instance is not initialized');
    }
    return db;
}

export async function QueryCheckJsinfoReadDbInstance() {
    if (JSINFO_NO_READ_DB) return QueryCheckJsinfoDbInstance();
    try {
        await readDb!.select().from(JsinfoSchema.latestblock).limit(1)
    } catch (e) {
        logger.info('QueryCheckJsinfoReadDbInstance exception, resetting connection', e)
        readDb = await GetJsinfoReadDb()
    }
}

export async function QueryInitJsinfoReadDbInstance() {
    if (JSINFO_NO_READ_DB) return QueryInitJsinfoDbInstance();
    logger.info('Starting queryserver - connecting to readDb')
    readDb = readDb || await GetJsinfoReadDb();
}

export function QueryGetJsinfoReadDbInstance(): PostgresJsDatabase {
    if (JSINFO_NO_READ_DB) return QueryGetJsinfoDbInstance();
    if (!readDb) {
        throw new Error('Read database instance is not initialized');
    }
    return readDb;
}

export async function QueryCheckRelaysReadDbInstance() {
    try {
        await relaysReadDb!.select().from(RelaysSchema.lavaReportError).limit(1)
    } catch (e) {
        logger.info('QueryCheckJsinfoReadDbInstance exception, resetting connection', e)
        relaysReadDb = await GetRelaysReadDb()
    }
}

export async function QueryInitRelaysReadDbInstance() {
    logger.info('Starting queryserver - connecting to relaysReadDb')
    relaysReadDb = relaysReadDb || await GetRelaysReadDb();
}

export function QueryGetRelaysReadDbInstance(): PostgresJsDatabase {
    if (!relaysReadDb) {
        throw new Error('relaysReadDb database instance is not initialized');
    }
    return relaysReadDb;
}

export async function GetLatestBlock() {
    const latestBlockData = await QueryGetJsinfoDbInstance()
        .select()
        .from(JsinfoSchema.latestblock)
        .limit(1);

    if (latestBlockData.length === 0) {
        return { latestHeight: 0, latestDatetime: 0 };
    }

    const latestBlock = latestBlockData[0];
    return {
        latestHeight: latestBlock.blockId,
        latestDatetime: latestBlock.timestamp.getTime()
    };
}