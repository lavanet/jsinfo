// ./src/query/dbUtils.ts

import { logger } from '../utils';
import { GetDb, GetReadDb } from '../dbUtils';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { desc } from "drizzle-orm";
import * as schema from '../schema';

let db: PostgresJsDatabase;
let readDb: PostgresJsDatabase;

export async function CheckDbInstance() {
    try {
        await db.select().from(schema.blocks).limit(1)
    } catch (e) {
        logger.info('CheckDbInstance exception, resetting connection', e)
        db = await GetDb()
    }
}

export async function InitDbInstance() {
    console.log('Starting queryserver - connecting to db')
    db = await GetDb();
}

export function GetDbInstance(): PostgresJsDatabase {
    if (!db) {
        throw new Error('Database instance is not initialized');
    }
    return db;
}

export async function CheckReadDbInstance() {
    try {
        await readDb.select().from(schema.blocks).limit(1)
    } catch (e) {
        logger.info('CheckReadDbInstance exception, resetting connection', e)
        readDb = await GetReadDb()
    }
}

export async function InitReadDbInstance() {
    console.log('Starting queryserver - connecting to readDb')
    readDb = await GetReadDb();
}

export function GetReadDbInstance(): PostgresJsDatabase {
    if (!readDb) {
        throw new Error('Read database instance is not initialized');
    }
    return readDb;
}

export async function GetLatestBlock() {
    //
    const latestDbBlocks = await GetDbInstance().select().from(schema.blocks).orderBy(desc(schema.blocks.height)).limit(1)
    let latestHeight = 0
    let latestDatetime = 0
    if (latestDbBlocks.length != 0) {
        latestHeight = latestDbBlocks[0].height == null ? 0 : latestDbBlocks[0].height
        latestDatetime = latestDbBlocks[0].datetime == null ? 0 : latestDbBlocks[0].datetime.getTime()
    }
    return { latestHeight, latestDatetime }
}