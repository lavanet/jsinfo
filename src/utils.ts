import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';

const postgre_url = process.env['POSTGRESQL_URL']!

export const MigrateDb = async () => {
    const migrationClient = postgres(postgre_url, { max: 1 });
    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" })
}

export const GetDb = () => {
    const queryClient = postgres(postgre_url);
    const db: PostgresJsDatabase = drizzle(queryClient);
    return db
}
