import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import leadsRouter from "./routes/leads.js";
const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
  });
});

app.use("/api/v1/leads", leadsRouter);

/**
 * Error middleware must be registered after routes.
 */
app.use(errorHandler);

export default app;
