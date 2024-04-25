// ./src/query/dbUtils.ts

import { logger } from '../utils';
import { GetDb, GetReadDb, GetRelaysReadDb } from '../dbUtils';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { desc } from "drizzle-orm";
import { JSINFO_NO_READ_DB } from './queryConsts';
import * as JsinfoSchema from '../schemas/jsinfo_schema';
import * as RelaysSchema from '../schemas/relays_schema';

let db: PostgresJsDatabase | null = null;
let readDb: PostgresJsDatabase | null = null;
let relaysReadDb: PostgresJsDatabase | null = null;

export async function QueryCheckDbInstance() {
    try {
        await db!.select().from(JsinfoSchema.blocks).limit(1)
    } catch (e) {
        logger.info('QueryCheckDbInstance exception, resetting connection', e)
        db = await GetDb()
    }
}

export async function QueryInitDbInstance() {
    console.log('Starting queryserver - connecting to db')
    db = db || await GetDb();
}

export function QueryGetDbInstance(): PostgresJsDatabase {
    if (!db) {
        throw new Error('Database instance is not initialized');
    }
    return db;
}

export async function QueryCheckReadDbInstance() {
    if (JSINFO_NO_READ_DB) return QueryCheckDbInstance();
    try {
        await readDb!.select().from(JsinfoSchema.blocks).limit(1)
    } catch (e) {
        logger.info('QueryCheckReadDbInstance exception, resetting connection', e)
        readDb = await GetReadDb()
    }
}

export async function QueryInitReadDbInstance() {
    if (JSINFO_NO_READ_DB) return QueryInitDbInstance();
    console.log('Starting queryserver - connecting to readDb')
    readDb = readDb || await GetReadDb();
}

export function QueryGetReadDbInstance(): PostgresJsDatabase {
    if (JSINFO_NO_READ_DB) return QueryGetDbInstance();
    if (!readDb) {
        throw new Error('Read database instance is not initialized');
    }
    return readDb;
}

export async function QueryCheckRelaysReadDbInstance() {
    try {
        await relaysReadDb!.select().from(RelaysSchema.lavaReportError).limit(1)
    } catch (e) {
        logger.info('QueryCheckReadDbInstance exception, resetting connection', e)
        relaysReadDb = await GetRelaysReadDb()
    }
}

export async function QueryInitRelaysReadDbInstance() {
    console.log('Starting queryserver - connecting to relaysReadDb')
    relaysReadDb = relaysReadDb || await GetRelaysReadDb();
}

export function QueryGetRelaysReadDbInstance(): PostgresJsDatabase {
    if (!relaysReadDb) {
        throw new Error('relaysReadDb database instance is not initialized');
    }
    return relaysReadDb;
}

export async function GetLatestBlock() {
    //
    const latestDbBlocks = await QueryGetDbInstance().select().from(JsinfoSchema.blocks).orderBy(desc(JsinfoSchema.blocks.height)).limit(1)
    let latestHeight = 0
    let latestDatetime = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
        latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
    }
    return { latestHeight, latestDatetime }
}