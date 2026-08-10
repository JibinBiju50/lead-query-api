import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

/*
 * Production providers commonly provide DATABASE_URL.
 * Locally, when DATABASE_URL is absent, node-postgres
 * automatically reads PGHOST, PGPORT, PGDATABASE,
 * PGUSER and PGPASSWORD.
 */
export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  : new Pool();

pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error,
  );
});

export async function verifyDatabaseConnection(): Promise<void> {
  const result = await pool.query<{
    database_name: string;
    server_time: Date;
  }>(`
    SELECT
      current_database() AS database_name,
      NOW() AS server_time
  `);

  const connection = result.rows[0];

  if (!connection) {
    throw new Error(
      "PostgreSQL returned no connection information",
    );
  }

  console.log(
    `Connected to PostgreSQL database: ${connection.database_name}`,
  );
}