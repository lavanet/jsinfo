// src/dbUtils.ts

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';
import { GetEnvVar, Sleep, logger } from './utils';
import { sql } from 'drizzle-orm';

let cachedPostgresUrl: string | null = null;

export async function GetPostgresUrl(): Promise<string> {
    if (cachedPostgresUrl !== null) {
        return cachedPostgresUrl;
    }
    try {
        cachedPostgresUrl = GetEnvVar("JSINFO_POSTGRESQL_URL");
    } catch (error) {
        try {
            cachedPostgresUrl = GetEnvVar("POSTGRESQL_URL");
        } catch (error) {
            logger.error("Missing env var for POSTGRESQL_URL or JSINFO_POSTGRESQL_URL");
            await Sleep(60000); // Sleep for one minute
            process.exit(1);
        }
    }
    return cachedPostgresUrl!;
}

let cachedReadPostgresUrl: string | null = null;

export async function GetReadPostgresUrl(): Promise<string> {
    if (cachedReadPostgresUrl !== null) {
        return cachedReadPostgresUrl;
    }
    try {
        cachedReadPostgresUrl = GetEnvVar("JSINFO_READ_POSTGRESQL_URL");
    } catch (error) {
        try {
            cachedReadPostgresUrl = GetEnvVar("READ_POSTGRESQL_URL");
        } catch (error) {
            logger.error("Missing env var for JSINFO_READ_POSTGRESQL_URL or READ_POSTGRESQL_URL");
            await Sleep(60000); // Sleep for one minute
            process.exit(1);
        }
    }
    return cachedReadPostgresUrl!;
}

let cachedRelaysReadPostgresUrl: string | null = null;

export async function GetRelaysReadPostgresUrl(): Promise<string> {
    if (cachedRelaysReadPostgresUrl !== null) {
        return cachedRelaysReadPostgresUrl;
    }
    try {
        cachedRelaysReadPostgresUrl = GetEnvVar("RELAYS_READ_POSTGRESQL_URL");
    } catch (error) {
        logger.error("Missing env var for RELAYS_READ_POSTGRESQL_URL or RELAYS_READ_POSTGRESQL_URL");
        await Sleep(60000); // Sleep for one minute
        process.exit(1);
    }
    return cachedRelaysReadPostgresUrl!;
}

// https://github.com/porsager/postgres?tab=readme-ov-file#connection-timeout

export async function GetJsinfoDb(): Promise<PostgresJsDatabase> {
    const queryClient = postgres(await GetPostgresUrl(), {
        idle_timeout: 20,
        connect_timeout: 20,
        max_lifetime: 75,
        max: 60,
    });
    const db: PostgresJsDatabase = drizzle(queryClient/*, { logger: true }*/);
    return db;
}

export async function GetJsinfoDbForIndexer(): Promise<PostgresJsDatabase> {
    const queryClient = postgres(await GetPostgresUrl(), {
        idle_timeout: 60 * 2,
        connect_timeout: 60 * 10,
    });
    const db: PostgresJsDatabase = drizzle(queryClient/*, { logger: true }*/);
    return db;
}

export async function GetJsinfoReadDb(): Promise<PostgresJsDatabase> {
    // use one db
    const queryClient = postgres(await GetReadPostgresUrl(), {
        idle_timeout: 20,
        connect_timeout: 20,
        max_lifetime: 75,
        max: 60,
    });
    const db: PostgresJsDatabase = drizzle(queryClient/*, { logger: true }*/);
    return db;
}

export async function GetRelaysReadDb(): Promise<PostgresJsDatabase> {
    const queryClient = postgres(await GetRelaysReadPostgresUrl(), {
        idle_timeout: 20,
        connect_timeout: 20,
        max_lifetime: 75,
        max: 60,
    });
    const db: PostgresJsDatabase = drizzle(queryClient/*, { logger: true }*/);
    return db;
}

export const MigrateDb = async () => {
    logger.info(`MigrateDb:: Starting database migration... ${new Date().toISOString()}`);
    let postgresUrl = await GetPostgresUrl();
    // console.log("MigrateDb:: postgresUrl", postgresUrl);
    const migrationClient = postgres(postgresUrl, { max: 1 });
    logger.info(`MigrateDb:: Migration client created. ${new Date().toISOString()}`);
    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" });
    logger.info(`MigrateDb:: Database migration completed. ${new Date().toISOString()}`);
}
