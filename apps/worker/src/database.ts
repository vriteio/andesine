import { createDatabase } from "@andesine/server/database";
import { config } from "./config";

const { db, pool } = createDatabase({ connectionString: config.DATABASE_URL });

export { db, pool };
