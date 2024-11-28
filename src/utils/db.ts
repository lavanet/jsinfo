import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { GetEnvVar, IsIndexerProcess } from './env';
import { logger } from './logger';
import PQueue from 'p-queue';
import { Sleep } from './sleep';
import postgres from 'postgres';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from 'drizzle-orm';
import { IsMeaningfulText, MaskPassword, JSONStringify } from './fmt';

interface DbConnection {
    db: PostgresJsDatabase;
    lastUsed: number;
    inUse: boolean;
    createdAt: number;
    id: string;
    connectionString: string;
}

const globalMigrationLock = {
    promise: null as Promise<void> | null,
    isComplete: false,
    error: null as Error | null
};

const JSINFO_PSQL_MAX_CONNECTIONS = parseInt(GetEnvVar("JSINFO_PSQL_MAX_CONNECTIONS", "1000"), 10);
const JSINFO_PSQL_MAX_CONNECTIONS_CONCURRENT = parseInt(GetEnvVar("JSINFO_PSQL_MAX_CONNECTIONS_CONCURRENT", "1000"), 10);
const RELAYS_PSQL_MAX_CONNECTIONS = parseInt(GetEnvVar("RELAYS_PSQL_MAX_CONNECTIONS", "500"), 10);
const RELAYS_PSQL_MAX_CONNECTIONS_CONCURRENT = parseInt(GetEnvVar("RELAYS_PSQL_MAX_CONNECTIONS_CONCURRENT", "500"), 10);

// Validate that all constants are positive integers
const validatePositiveInteger = (value: number, name: string) => {
    if (isNaN(value) || value <= 0) {
        throw new Error(`Invalid value for ${name}: ${value}. It must be a positive integer.`);
    }
};

validatePositiveInteger(JSINFO_PSQL_MAX_CONNECTIONS, "JSINFO_PSQL_MAX_CONNECTIONS");
validatePositiveInteger(JSINFO_PSQL_MAX_CONNECTIONS_CONCURRENT, "JSINFO_PSQL_MAX_CONNECTIONS_CONCURRENT");
validatePositiveInteger(RELAYS_PSQL_MAX_CONNECTIONS, "RELAYS_PSQL_MAX_CONNECTIONS");
validatePositiveInteger(RELAYS_PSQL_MAX_CONNECTIONS_CONCURRENT, "RELAYS_PSQL_MAX_CONNECTIONS_CONCURRENT");

class DbConnectionPoolClass {
    private connections: DbConnection[] = [];
    private connectionString: "jsinfo" | "relays";
    private activeQueries = new Map<string, Promise<any>>();
    private queue: PQueue;
    private readonly MAX_CONNECTIONS: number = 90;
    private readonly CONNECTION_TTL = 1000 * 60 * 10;  // 10 minutes
    private readonly CLEANUP_INTERVAL = 1000 * 60;     // 1 minute
    private cachedPostgresUrl: string | null = null;
    private cachedRelaysReadPostgresUrl: string | null = null;
    private urlFailures: Map<string, { failures: number; lastFailure: number }> = new Map();
    private readonly FAILURE_THRESHOLD = 3;
    private readonly FAILURE_RESET_TIME = 1000 * 60 * 5; // 5 minutes
    private currentUrlIndex = 0;
    private lastConnectionWarning = 0;
    private readonly WARNING_INTERVAL = 30000; // Only log every 10 seconds

    constructor(connectionString: "jsinfo" | "relays") {

        this.MAX_CONNECTIONS = connectionString === "jsinfo" ? JSINFO_PSQL_MAX_CONNECTIONS : RELAYS_PSQL_MAX_CONNECTIONS;
        const max_connections_concurently = connectionString === "jsinfo" ? JSINFO_PSQL_MAX_CONNECTIONS_CONCURRENT : RELAYS_PSQL_MAX_CONNECTIONS;

        this.queue = new PQueue({ concurrency: max_connections_concurently });
        this.connectionString = connectionString;
        this.startConnectionManager();
        this.migrateDb().catch(error => {
            logger.error('Failed to run migrations on startup:', error);
            process.exit(1);
        });
    }

    private startConnectionManager() {
        setInterval(() => this.cleanupConnections(), this.CLEANUP_INTERVAL);
    }

    private async cleanupConnections() {
        const now = Date.now();
        const staleConnections = this.connections.filter(conn => {
            const isStale = !conn.inUse && (
                now - conn.lastUsed > this.CONNECTION_TTL ||
                now - conn.createdAt > this.CONNECTION_TTL
            );

            if (isStale) {
                logger.info('Cleaning up stale connection', {
                    connectionId: conn.id,
                    age: now - conn.createdAt,
                    idleTime: now - conn.lastUsed
                });
            }

            return isStale;
        });

        // Remove stale connections
        this.connections = this.connections.filter(conn =>
            !staleConnections.includes(conn));

        // Log pool status
        logger.info(this.connectionString === "jsinfo" ? 'Jsinfo DB Connection pool status' : 'Relays DB Connection pool status', {
            totalConnections: this.connections.length,
            activeQueries: this.activeQueries.size,
            queueSize: this.queue.size,
            staleConnectionsRemoved: staleConnections.length
        });
    }

    private async GetJsinfoPostgresUrls(): Promise<string[]> {
        if (this.cachedPostgresUrl !== null) {
            return [this.cachedPostgresUrl];
        }

        const urls = new Set<string>();
        for (const envVar of [
            "JSINFO_POSTGRESQL_URL_1",
            "JSINFO_POSTGRESQL_URL",
            "POSTGRESQL_URL_1",
            "POSTGRESQL_URL"
        ]) {
            try {
                const url = GetEnvVar(envVar, "-");
                if (IsMeaningfulText(url)) urls.add(url);
            } catch (error) {
                continue;
            }
        }

        if (urls.size === 0) {
            logger.error("Missing env var for any PostgreSQL URL");
            await Sleep(60000);
            process.exit(1);
        }

        this.cachedPostgresUrl = Array.from(urls)[0];
        return Array.from(urls);
    }

    private async GetRelaysPostgresUrls(): Promise<string[]> {
        if (this.cachedRelaysReadPostgresUrl !== null) {
            return [this.cachedRelaysReadPostgresUrl];
        }

        const urls = new Set<string>();
        for (const envVar of [
            "RELAYS_READ_POSTGRESQL_URL_1",
            "RELAYS_READ_POSTGRESQL_URL"
        ]) {
            try {
                const url = GetEnvVar(envVar);
                if (url) urls.add(url);
            } catch (error) {
                continue;
            }
        }

        if (urls.size === 0) {
            logger.error("Missing env var for RELAYS_READ_POSTGRESQL_URL");
            await Sleep(60000);
            process.exit(1);
        }

        this.cachedRelaysReadPostgresUrl = Array.from(urls)[0];
        return Array.from(urls);
    }

    private async getNextValidUrl(urls: string[]): Promise<string> {
        const now = Date.now();

        // Reset failure counts if enough time has passed
        this.urlFailures.forEach((data, url) => {
            if (now - data.lastFailure > this.FAILURE_RESET_TIME) {
                this.urlFailures.delete(url);
            }
        });

        // Try URLs in order, skipping ones that have failed too recently
        for (let i = 0; i < urls.length; i++) {
            const index = (this.currentUrlIndex + i) % urls.length;
            const url = urls[index];
            const failures = this.urlFailures.get(url);

            if (!failures || failures.failures < this.FAILURE_THRESHOLD) {
                this.currentUrlIndex = index;
                return url;
            }
        }

        // If all URLs are failing, use the least recently failed one
        this.urlFailures.clear(); // Reset all failures
        this.currentUrlIndex = 0;
        return urls[0];
    }

    private async createConnection(): Promise<DbConnection> {
        const urls = this.connectionString === "jsinfo"
            ? await this.GetJsinfoPostgresUrls()
            : await this.GetRelaysPostgresUrls();

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < urls.length; attempt++) {
            try {
                const url = await this.getNextValidUrl(urls);
                const db = await this.createDbConnection(url);
                await db.select({ now: sql`NOW()` }).from(sql`(SELECT 1) AS foo`).limit(1);
                logger.info('Database connection established', {
                    url: MaskPassword(url)
                });
                return {
                    db,
                    lastUsed: Date.now(),
                    inUse: false,
                    createdAt: Date.now(),
                    id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                    connectionString: url
                };
            } catch (error) {
                lastError = error as Error;
                const url = urls[this.currentUrlIndex];
                const failures = this.urlFailures.get(url) || { failures: 0, lastFailure: 0 };

                this.urlFailures.set(url, {
                    failures: failures.failures + 1,
                    lastFailure: Date.now()
                });

                logger.error('Database connection failed', {
                    url: MaskPassword(url),
                    attempt: attempt + 1,
                    error: (error as Error).message
                });
            }
        }

        throw lastError || new Error('Failed to connect to any database URL');
    }

    private async createDbConnection(url: string): Promise<PostgresJsDatabase> {
        const config = this.connectionString === "jsinfo"
            ? {
                idle_timeout: 60 * 2,
                connect_timeout: 60 * 10,
                max_lifetime: 60 * 4,
            }
            : {
                idle_timeout: 20,
                connect_timeout: 20,
                max_lifetime: 75,
                max: 60,
            };

        const queryClient = postgres(url, config);
        return drizzle(queryClient);
    }

    private async getConnection(queryKey: string): Promise<DbConnection> {
        // Wait for migrations to complete before allowing connections
        await this.migrateDb();

        // Create new connection for each query
        const conn = await this.createConnection();
        this.connections.push(conn);

        logger.info('Created new connection for query', {
            connectionId: conn.id,
            totalConnections: this.connections.length,
            queryKey: queryKey
        });

        conn.inUse = true;
        return conn;
    }

    async executeQuery<T extends Record<string, any>>(
        queryFn: (db: PostgresJsDatabase) => Promise<T>,
        queryKey: string,
        priority: "low" | "normal" | "high" = "normal"
    ): Promise<T> {
        await this.migrateDb();

        const existingQuery = this.activeQueries.get(queryKey);
        if (existingQuery) {
            logger.info('Reusing existing query', {
                queryKey,
                poolStats: {
                    activeQueries: this.activeQueries.size,
                    queueSize: this.queue.size
                }
            });
            return existingQuery as Promise<T>;
        }

        // If priority is high, skip connection limit checks
        if (priority === "high") {
            logger.info(`Executing high priority query immediately: ${queryKey}`);
            const conn = await this.getConnection(queryKey);
            return await queryFn(conn.db);
        }

        // Wait if we've hit the connection limit for normal/low priority
        while (this.connections.length >= this.MAX_CONNECTIONS) {
            const now = Date.now();
            if (now - this.lastConnectionWarning > this.WARNING_INTERVAL) {
                logger.info(this.connectionString === "jsinfo" ? 'Jsinfo DB Connection pool status' : 'Relays DB Connection pool status', {
                    queryKey,
                    activeConnections: this.connections.length,
                    maxConnections: this.MAX_CONNECTIONS
                });
                this.lastConnectionWarning = now;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const queryPromise = this.queue.add(async () => {
            const startTime = Date.now();
            const conn = await this.getConnection(queryKey);
            const maxRetries = 3;
            const delays = [500, 1000, 1500];

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    return await queryFn(conn.db).finally(async () => {
                        // Close the postgres client
                        if (this.connections.includes(conn)) return;

                        await (conn.db as any).client.end();
                        // Remove from connections array
                        this.connections = this.connections.filter(c => c.id !== conn.id);

                        const duration = Date.now() - startTime;
                        if (duration > 1000) {
                            logger.info('Slow query completed', {
                                queryKey,
                                duration,
                                attempt: attempt + 1
                            });
                        }

                        logger.info('Connection closed after query', {
                            connectionId: conn.id,
                            remainingConnections: this.connections.length
                        });
                    });
                } catch (error) {
                    const isLastAttempt = attempt === maxRetries - 1;

                    logger.error('DB Query failed - Error details:', {
                        code: (error as any).code,
                        constraint: (error as any).constraint,
                        detail: (error as any).detail,
                        message: (error as Error).message,
                        name: (error as Error).name,
                        schema: (error as any).schema,
                        table: (error as any).table
                    });

                    logger.error('DB Query failed - Query info:', {
                        attempt: `${attempt + 1}/${maxRetries}`,
                        key: queryKey,
                        connection: MaskPassword(this.connectionString),
                        connectionId: conn.id,
                    });

                    logger.error('DB Query failed - Connection info:', {
                        age: `${Math.round((Date.now() - conn.createdAt) / 1000)}s`,
                        idleTime: `${Math.round((Date.now() - conn.lastUsed) / 1000)}s`
                    });

                    logger.error('DB Query failed - Pool stats:', {
                        activeQueries: this.activeQueries.size,
                        connections: this.connections.length,
                        maxConnections: this.MAX_CONNECTIONS,
                        queueSize: this.queue.size
                    });

                    if (!isLastAttempt) {
                        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
                    } else {
                        throw error;
                    }
                }
            }

            throw new Error('Query failed after all retries');
        }).finally(() => {
            this.activeQueries.delete(queryKey);
        });

        this.activeQueries.set(queryKey, queryPromise);
        return queryPromise as Promise<T>;
    }

    public async migrateDb(): Promise<void> {
        if (this.connectionString !== "jsinfo") {
            return;
        }

        if (!IsIndexerProcess()) {
            return;
        }

        if (GetEnvVar("JSINFO_INDEXER_RUN_MIGRATIONS", "false") === "false") {
            return;
        }

        if (globalMigrationLock.isComplete) {
            return;
        }

        if (!globalMigrationLock.promise) {
            globalMigrationLock.promise = (async () => {
                try {
                    globalMigrationLock.isComplete = false;

                    logger.info(`MigrateDb:: Starting database migration...`);
                    const urls = await this.GetJsinfoPostgresUrls();
                    const url = await this.getNextValidUrl(urls);

                    const migrationClient = postgres(url, { max: 1 });
                    logger.info(`MigrateDb:: Migration client created.`);

                    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" });
                    logger.info(`MigrateDb:: Database migration completed.`);
                    globalMigrationLock.isComplete = true;
                } catch (error) {
                    logger.error('Migration failed:', {
                        error,
                        details: {
                            errorName: (error as Error)?.name,
                            errorMessage: (error as Error)?.message,
                            errorStack: (error as Error)?.stack,
                            timestamp: new Date().toISOString(),
                            connectionString: MaskPassword(this.connectionString),
                            postgresUrls: await this.GetJsinfoPostgresUrls().catch(e => `Failed to get URLs: ${e.message}`),
                            migrationState: {
                                isComplete: globalMigrationLock.isComplete,
                                hasExistingPromise: !!globalMigrationLock.promise,
                                error: globalMigrationLock.error?.message
                            },
                            environment: {
                                JSINFO_INDEXER_RUN_MIGRATIONS: MaskPassword(GetEnvVar("JSINFO_INDEXER_RUN_MIGRATIONS", "false")),
                                JSINFO_POSTGRESQL_URL: MaskPassword(GetEnvVar("JSINFO_POSTGRESQL_URL", "")),
                                NODE_ENV: MaskPassword(process.env.NODE_ENV || "")
                            }
                        }
                    });
                    globalMigrationLock.promise = null;
                    throw error;
                }
            })();
        }

        return await globalMigrationLock.promise;
    }
}

const DbConnectionPoolJsinfo = new DbConnectionPoolClass("jsinfo");
const DbConnectionPoolRelays = new DbConnectionPoolClass("relays");

export async function queryJsinfo<T extends Record<string, any>>(
    queryFn: (db: PostgresJsDatabase) => Promise<T>,
    queryKey: string,
    priority: "low" | "normal" | "high" = "normal"
): Promise<T> {
    return DbConnectionPoolJsinfo.executeQuery<T>(queryFn, queryKey, priority);
}

export async function queryRelays<T extends Record<string, any>>(
    queryFn: (db: PostgresJsDatabase) => Promise<T>,
    queryKey: string,
    priority: "low" | "normal" | "high" = "normal"
): Promise<T> {
    return DbConnectionPoolRelays.executeQuery<T>(queryFn, queryKey, priority);
}

export async function CheckDatabaseStatus(): Promise<{ ok: boolean; details: string }> {
    try {
        // Test both connection pools with a simple query
        await queryJsinfo(
            async (db) => db.select({ now: sql`NOW()` }).from(sql`(SELECT 1) AS foo`).limit(1),
            'health_check_jsinfo'
        );
        await queryRelays(
            async (db) => db.select({ now: sql`NOW()` }).from(sql`(SELECT 1) AS foo`).limit(1),
            'health_check_relays'
        );

        const poolStats = {
            jsinfo: {
                connections: DbConnectionPoolJsinfo['connections'].length,
                activeQueries: DbConnectionPoolJsinfo['activeQueries'].size,
                queueSize: DbConnectionPoolJsinfo['queue'].size
            },
            relays: {
                connections: DbConnectionPoolRelays['connections'].length,
                activeQueries: DbConnectionPoolRelays['activeQueries'].size,
                queueSize: DbConnectionPoolRelays['queue'].size
            }
        };

        return {
            ok: true,
            details: `Database connections healthy. Pool stats: ${JSONStringify(poolStats)}`
        };
    } catch (error) {
        return {
            ok: false,
            details: `Database connection error: ${(error as Error).message}`
        };
    }
}
