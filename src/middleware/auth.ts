import type {
  NextFunction,
  Request,
  Response,
} from "express";
import { z } from "zod";

import { UnauthenticatedError } from "../errors.js";
import { userRoles } from "../types/current-user.js";

const authenticationHeadersSchema = z.object({
  tenantId: z
    .string()
    .uuid("x-tenant-id must be a valid UUID"),

  userId: z
    .string()
    .uuid("x-user-id must be a valid UUID"),

  role: z.enum(userRoles),
});

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
    const tenantId = req.header("x-tenant-id");
const userId = req.header("x-user-id");
const role = req.header("x-user-role");

if (!tenantId || !userId || !role) {
  next(
    new UnauthenticatedError(
      "x-tenant-id, x-user-id, and x-user-role headers are required",
    ),
  );

  return;
}
  const validationResult =
    authenticationHeadersSchema.safeParse({
      tenantId: req.header("x-tenant-id"),
      userId: req.header("x-user-id"),
      role: req.header("x-user-role"),
    });

  if (!validationResult.success) {
    const firstIssue = validationResult.error.issues[0];

    next(
      new UnauthenticatedError(
        firstIssue?.message ?? "Invalid authentication headers",
      ),
    );

    return;
  }

  req.currentUser = validationResult.data;

  next();
}