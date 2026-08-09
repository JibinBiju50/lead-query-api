import type { CurrentUser } from "../types/current-user.js";
import type {
  SqlParameterBuilder,
} from "./sql-parameter-builder.js";

export function buildVisibilityClauses(
  currentUser: CurrentUser,
  parameters: SqlParameterBuilder,
): string[] {
  const tenantPlaceholder = parameters.add(
    currentUser.tenantId,
  );

  /*
   * Tenant isolation is unconditional.
   *
   * This clause must exist for every role, including owner
   * and admin. A privileged role may see all leads only
   * inside its own tenant.
   */
  const clauses = [
    `lead.tenant_id = ${tenantPlaceholder}`,
  ];

  if (currentUser.role === "agent") {
    const userPlaceholder = parameters.add(
      currentUser.userId,
    );

    /*
     * Agents can only see leads assigned to themselves.
     * Privileged roles need no additional visibility clause.
     */
    clauses.push(
      `lead.assigned_to = ${userPlaceholder}`,
    );
  }

  return clauses;
}