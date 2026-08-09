import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { ZodError } from "zod";

import { BadRequestError } from "../errors.js";
import {
  queryLeadsBodySchema,
  queryLeadsQuerySchema,
} from "../validation/query-leads.js";

function formatValidationError(
  source: "query" | "body",
  error: ZodError,
): string {
  return error.issues
    .map((issue) => {
      const path =
        issue.path.length > 0
          ? `.${issue.path.join(".")}`
          : "";

      return `${source}${path}: ${issue.message}`;
    })
    .join("; ");
}

export function validateQueryLeadsRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const queryResult =
    queryLeadsQuerySchema.safeParse(req.query);

  if (!queryResult.success) {
    next(
      new BadRequestError(
        formatValidationError(
          "query",
          queryResult.error,
        ),
      ),
    );

    return;
  }

  const bodyResult =
    queryLeadsBodySchema.safeParse(
      req.body ?? {},
    );

  if (!bodyResult.success) {
    next(
      new BadRequestError(
        formatValidationError(
          "body",
          bodyResult.error,
        ),
      ),
    );

    return;
  }

  req.queryOptions = queryResult.data;
  req.queryBody = bodyResult.data;

  next();
}