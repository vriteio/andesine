import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import { schema } from "./schema";

interface DatabaseOptions extends PoolConfig {
  connectionString: string;
}

type Database = ReturnType<typeof createDatabase>["db"];
type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseClient = Database | DatabaseTransaction;

const createDatabase = (options: DatabaseOptions) => {
  const pool = new Pool(options);
  const db = drizzle({ client: pool, schema, casing: "snake_case" });

  return { db, pool };
};

export { createDatabase };
export type { DatabaseOptions, Database, DatabaseTransaction, DatabaseClient };
