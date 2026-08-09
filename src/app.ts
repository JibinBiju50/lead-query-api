import express from "express";
import { authenticate } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
  });
});

/**
 * Temporary route for checking authentication middleware.
 */
app.get("/api/v1/auth/check", authenticate, (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Authentication headers are valid",
    data: {
      currentUser: req.currentUser,
    },
  });
});

/**
 * Error middleware must be registered after routes.
 */
app.use(errorHandler);

export default app;