import type {
  SqlParameterBuilder,
} from "./sql-parameter-builder.js";

export function buildLeadSearchClause(
  q: string | undefined,
  parameters: SqlParameterBuilder,
): string | null {
  const trimmedQuery = q?.trim();

  if (!trimmedQuery) {
    return null;
  }

  /*
   * One parameter can safely be reused multiple times
   * inside the same SQL query.
   */
  const searchPlaceholder = parameters.add(
    `%${trimmedQuery}%`,
  );

  /*
   * Parentheses are important.
   *
   * Without them, SQL's AND/OR precedence could allow
   * one of these OR conditions to bypass tenant scoping.
   */
  return `
    (
      lead.name ILIKE ${searchPlaceholder}
      OR lead.phone ILIKE ${searchPlaceholder}
      OR lead.email ILIKE ${searchPlaceholder}
      OR lead.e164 ILIKE ${searchPlaceholder}
    )
  `;
}