import { schema } from "#backend/db/schema";
import { config } from "#backend/lib/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DatabaseClient = DatabaseTransaction | typeof db;

const pool = new Pool({
  connectionString: config.DATABASE_URL
});
const db = drizzle({ client: pool, schema, casing: "snake_case" });

export { db, pool };
export type { DatabaseTransaction, DatabaseClient };
