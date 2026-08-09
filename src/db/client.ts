import "dotenv/config";
import pg from "pg";

const { Pool } = pg;


export const pool = new Pool();

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

//verify the connection by running a SQL query
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
    throw new Error("PostgreSQL returned no connection information");
  }

  console.log(
    `Connected to PostgreSQL database: ${connection.database_name}`,
  );
  console.log(`Database time: ${connection.server_time}`);
}