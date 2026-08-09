import type { CurrentUser } from "../types/current-user.js";
import type {
  FilterLogic,
} from "../types/lead-filter.js";
import type {
  QueryLeadsBody,
} from "../validation/query-leads.js";
import type {
  CustomFieldDefinition,
} from "./custom-fields.js";
import {
  buildLeadFilterClause,
} from "./filters.js";
import {
  buildLeadSearchClause,
} from "./search.js";
import {
  SqlParameterBuilder,
} from "./sql-parameter-builder.js";
import {
  buildVisibilityClauses,
} from "./visibility.js";

type LeadFilter = QueryLeadsBody["filters"][number];

type BuildLeadWhereClauseInput = {
  currentUser: CurrentUser;
  q: string | undefined;
  filters: LeadFilter[];
  logic: FilterLogic;
  customFields: Map<
    string,
    CustomFieldDefinition
  >;
};

export type BuiltWhereClause = {
  sql: string;
  values: unknown[];
};

export function buildLeadWhereClause(
  input: BuildLeadWhereClauseInput,
): BuiltWhereClause {
  const parameters =
    new SqlParameterBuilder();

  const clauses = buildVisibilityClauses(
    input.currentUser,
    parameters,
  );

  const searchClause = buildLeadSearchClause(
    input.q,
    parameters,
  );

  if (searchClause) {
    clauses.push(searchClause);
  }

  const filterClause =
    buildLeadFilterClause({
      filters: input.filters,
      logic: input.logic,
      tenantId: input.currentUser.tenantId,
      customFields: input.customFields,
      parameters,
    });

  if (filterClause) {
    clauses.push(filterClause);
  }

  /*
   * Search and structured filters are both top-level
   * groups, so they are always combined using AND.
   */
  return {
    sql: `WHERE ${clauses.join("\nAND ")}`,
    values: parameters.toArray(),
  };
}