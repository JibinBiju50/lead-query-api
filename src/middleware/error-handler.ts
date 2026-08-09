import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "../errors.js";

type JsonParseError = SyntaxError & {
  status?: number;
  type?: string;
  body?: unknown;
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      statusCode: error.statusCode,
    });

    return;
  }

  const jsonError = error as JsonParseError;

  if (
    error instanceof SyntaxError &&
    jsonError.status === 400 &&
    jsonError.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      message: "Request body contains invalid JSON",
      statusCode: 400,
    });

    return;
  }

  console.error("Unhandled error:", error);

  res.status(500).json({
    message: "Internal server error",
    statusCode: 500,
  });
};