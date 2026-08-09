import "dotenv/config";

import app from "./app.js";
import {
  pool,
  verifyDatabaseConnection,
} from "./db/client.js";

const port = Number(process.env.PORT) || 3000;

async function startServer(): Promise<void> {
  try {
    await verifyDatabaseConnection();

    const server = app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
    
    // logs which signal recieved, closes the http server and then closes the postgreql connection
    const shutdown = (signal: string): void => {
      console.log(`${signal} received. Shutting down...`);

      server.close(async (serverError) => {
        if (serverError) {
          console.error("Failed to close HTTP server:", serverError);
          process.exit(1);
        }

        try {
          await pool.end();
          console.log("PostgreSQL pool closed");
          process.exit(0);
        } catch (databaseError) {
          console.error(
            "Failed to close PostgreSQL pool:",
            databaseError,
          );
          process.exit(1);
        }
      });
    };
    
    //listens for termination signals and calls shutdown function
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error);
    process.exit(1);
  }
}

void startServer();