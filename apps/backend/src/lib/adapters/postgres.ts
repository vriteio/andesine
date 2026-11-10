import { createDatabase } from "@andesine/server/database";
import { config } from "#backend/lib/config";

const { db, pool } = createDatabase({ connectionString: config.DATABASE_URL });

export { db, pool };
