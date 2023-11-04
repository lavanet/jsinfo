import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from 'postgres';

const postgre_url = process.env['POSTGRESQL_URL']!

export const MigrateDb = async () => {
    const migrationClient = postgres(postgre_url, { max: 1 });
    await migrate(drizzle(migrationClient), { migrationsFolder: "drizzle" })
}

export const GetDb = () => {
    const queryClient = postgres(postgre_url, {
        idle_timeout: 20,
        max_lifetime: 60 * 30,
    });
    const db: PostgresJsDatabase = drizzle(queryClient);
    return db
}

export async function DoInChunks(sz: number, arr: any, cb: (arr: any) => Promise<any>) {
    while (arr.length != 0) {
        const tmpArr = arr.splice(0, sz)
        await cb(tmpArr)
    }
    return
}