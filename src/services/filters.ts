import { BadRequestError } from "../errors.js";
import {
  isSystemFieldId,
  type FilterCondition,
  type FilterLogic,
} from "../types/lead-filter.js";
import type {
  QueryLeadsBody,
} from "../validation/query-leads.js";
import type {
  CustomFieldDefinition,
} from "./custom-fields.js";
import type {
  SqlParameterBuilder,
} from "./sql-parameter-builder.js";

type LeadFilter = QueryLeadsBody["filters"][number];

type BuildFilterClauseInput = {
  filters: LeadFilter[];
  logic: FilterLogic;
  tenantId: string;
  customFields: Map<
    string,
    CustomFieldDefinition
  >;
  parameters: SqlParameterBuilder;
};

const stringColumns = {
  name: "lead.name",
  phone: "lead.phone",
  email: "lead.email",
} as const;

const dateColumns = {
  followUpDate: {
    column: "lead.follow_up_date",
    isTimestamp: false,
  },
  createdAt: {
    column: "lead.created_at",
    isTimestamp: true,
  },
  updatedAt: {
    column: "lead.updated_at",
    isTimestamp: true,
  },
} as const;

function requireFilterValue(
  filter: LeadFilter,
): string {
  const value = filter.value?.trim();

  if (!value) {
    /*
     * Zod should reject this before the compiler runs.
     * This is a defensive check in case the service is
     * called from somewhere without that middleware.
     */
    throw new BadRequestError(
      `A value is required for condition "${filter.condition}"`,
    );
  }

  return value;
}

function splitUuidList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildStringColumnClause(
  column: string,
  filter: LeadFilter,
  parameters: SqlParameterBuilder,
): string {
  const { condition } = filter;

  if (condition === "is empty") {
    return `(${column} IS NULL OR BTRIM(${column}) = '')`;
  }

  if (condition === "is not empty") {
    return `(${column} IS NOT NULL AND BTRIM(${column}) <> '')`;
  }

  const value = requireFilterValue(filter);

  switch (condition) {
    case "is": {
      const placeholder = parameters.add(value);

      return `LOWER(${column}) = LOWER(${placeholder})`;
    }

    case "is not": {
      const placeholder = parameters.add(value);

      /*
       * PostgreSQL normally evaluates:
       *   NULL <> 'something'
       * as NULL, not TRUE.
       *
       * The explicit null check makes nullable email rows
       * count as "not equal", as required by the task.
       */
      return `(
        ${column} IS NULL
        OR LOWER(${column}) <> LOWER(${placeholder})
      )`;
    }

    case "contain": {
      const placeholder =
        parameters.add(`%${value}%`);

      return `${column} ILIKE ${placeholder}`;
    }

    case "does not contain": {
      const placeholder =
        parameters.add(`%${value}%`);

      return `(
        ${column} IS NULL
        OR ${column} NOT ILIKE ${placeholder}
      )`;
    }

    case "starts with": {
      const placeholder =
        parameters.add(`${value}%`);

      return `${column} ILIKE ${placeholder}`;
    }

    case "ends with": {
      const placeholder =
        parameters.add(`%${value}`);

      return `${column} ILIKE ${placeholder}`;
    }

    default:
      throw new BadRequestError(
        `Condition "${condition}" is not supported for string field "${filter.fieldId}"`,
      );
  }
}

function buildAgentColumnClause(
  column: string,
  filter: LeadFilter,
  parameters: SqlParameterBuilder,
): string {
  if (filter.condition === "is empty") {
    return `${column} IS NULL`;
  }

  if (filter.condition === "is not empty") {
    return `${column} IS NOT NULL`;
  }

  const userIds = splitUuidList(
    requireFilterValue(filter),
  );

  const placeholder =
    parameters.add(userIds);

  switch (filter.condition) {
    case "is":
    case "contain":
      /*
       * PostgreSQL ANY checks whether the column matches
       * any UUID in the supplied array.
       */
      return `${column} = ANY(${placeholder}::uuid[])`;

    case "is not":
    case "does not contain":
      /*
       * A null assigned_to value does not match any agent,
       * so it should count as "not assigned to these users".
       */
      return `(
        ${column} IS NULL
        OR NOT (${column} = ANY(${placeholder}::uuid[]))
      )`;

    default:
      throw new BadRequestError(
        `Condition "${filter.condition}" is not supported for "${filter.fieldId}"`,
      );
  }
}

function buildDateColumnClause(
  column: string,
  isTimestamp: boolean,
  filter: LeadFilter,
  parameters: SqlParameterBuilder,
): string {
  if (filter.condition === "is empty") {
    return `${column} IS NULL`;
  }

  if (filter.condition === "is not empty") {
    return `${column} IS NOT NULL`;
  }

  const value = requireFilterValue(filter);
  const placeholder = parameters.add(value);

  switch (filter.condition) {
    case "before":
      return `${column} < ${placeholder}::date`;

    case "after":
      return `${column} > ${placeholder}::date`;

    case "is":
      /*
       * created_at and updated_at contain times.
       * Casting to date implements "same calendar day".
       */
      return isTimestamp
        ? `${column}::date = ${placeholder}::date`
        : `${column} = ${placeholder}::date`;

    default:
      throw new BadRequestError(
        `Condition "${filter.condition}" is not supported for date field "${filter.fieldId}"`,
      );
  }
}

function buildSystemFilterClause(
  filter: LeadFilter,
  parameters: SqlParameterBuilder,
): string {
  if (
    filter.fieldId in stringColumns
  ) {
    const column =
      stringColumns[
        filter.fieldId as keyof typeof stringColumns
      ];

    return buildStringColumnClause(
      column,
      filter,
      parameters,
    );
  }

  if (filter.fieldId === "assignedTo") {
    return buildAgentColumnClause(
      "lead.assigned_to",
      filter,
      parameters,
    );
  }

  if (filter.fieldId === "createdBy") {
    return buildAgentColumnClause(
      "lead.user_id",
      filter,
      parameters,
    );
  }

  if (filter.fieldId in dateColumns) {
    const dateField =
      dateColumns[
        filter.fieldId as keyof typeof dateColumns
      ];

    return buildDateColumnClause(
      dateField.column,
      dateField.isTimestamp,
      filter,
      parameters,
    );
  }

  throw new BadRequestError(
    `Unsupported system field "${filter.fieldId}"`,
  );
}

function buildCustomExistsClause(
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  predicate: string,
): string {
  return `
    EXISTS (
      SELECT 1
      FROM lead_custom_field_values AS custom_value
      INNER JOIN custom_fields AS custom_field
        ON custom_field.id = custom_value.field_id
      WHERE custom_value.lead_id = lead.id
        AND custom_value.field_id = ${fieldPlaceholder}
        AND custom_field.tenant_id = ${tenantPlaceholder}
        AND custom_field.status = TRUE
        AND ${predicate}
    )
  `;
}

function buildCustomNotExistsClause(
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  predicate: string,
): string {
  return `
    NOT EXISTS (
      SELECT 1
      FROM lead_custom_field_values AS custom_value
      INNER JOIN custom_fields AS custom_field
        ON custom_field.id = custom_value.field_id
      WHERE custom_value.lead_id = lead.id
        AND custom_value.field_id = ${fieldPlaceholder}
        AND custom_field.tenant_id = ${tenantPlaceholder}
        AND custom_field.status = TRUE
        AND ${predicate}
    )
  `;
}

function buildCustomStringClause(
  filter: LeadFilter,
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  parameters: SqlParameterBuilder,
): string {
  if (filter.condition === "is empty") {
    /*
     * Empty means:
     * - there is no EAV row for this field; or
     * - the stored value is null/blank.
     *
     * We implement that by confirming no non-empty row exists.
     */
    return buildCustomNotExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  if (filter.condition === "is not empty") {
    return buildCustomExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  const value = requireFilterValue(filter);

  switch (filter.condition) {
    case "is": {
      const placeholder = parameters.add(value);

      return buildCustomExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `LOWER(custom_value.value) = LOWER(${placeholder})`,
      );
    }

    case "is not": {
      const placeholder = parameters.add(value);

      /*
       * Missing values also count as "not equal".
       * Therefore we use NOT EXISTS around rows that match.
       */
      return buildCustomNotExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `LOWER(custom_value.value) = LOWER(${placeholder})`,
      );
    }

    case "contain": {
      const placeholder =
        parameters.add(`%${value}%`);

      return buildCustomExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `custom_value.value ILIKE ${placeholder}`,
      );
    }

    case "does not contain": {
      const placeholder =
        parameters.add(`%${value}%`);

      return buildCustomNotExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `custom_value.value ILIKE ${placeholder}`,
      );
    }

    case "starts with": {
      const placeholder =
        parameters.add(`${value}%`);

      return buildCustomExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `custom_value.value ILIKE ${placeholder}`,
      );
    }

    case "ends with": {
      const placeholder =
        parameters.add(`%${value}`);

      return buildCustomExistsClause(
        fieldPlaceholder,
        tenantPlaceholder,
        `custom_value.value ILIKE ${placeholder}`,
      );
    }

    default:
      throw new BadRequestError(
        `Condition "${filter.condition}" is not supported for custom string fields`,
      );
  }
}

function buildCustomNumberClause(
  filter: LeadFilter,
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  parameters: SqlParameterBuilder,
): string {
  if (filter.condition === "is empty") {
    return buildCustomNotExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  if (filter.condition === "is not empty") {
    return buildCustomExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  const placeholder = parameters.add(
    requireFilterValue(filter),
  );

  /*
   * EAV values are stored as text.
   *
   * Casting arbitrary text directly to NUMERIC could crash
   * the entire query if a malformed value exists. The CASE
   * expression casts only strings that look numeric.
   */
  const numericExpression = `
    CASE
      WHEN BTRIM(custom_value.value) ~
        '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
      THEN BTRIM(custom_value.value)::numeric
      ELSE NULL
    END
  `;

  let comparison: string;

  switch (filter.condition) {
    case "is":
      comparison =
        `${numericExpression} = ${placeholder}::numeric`;
      break;

    case "greater than":
      comparison =
        `${numericExpression} > ${placeholder}::numeric`;
      break;

    case "less than":
      comparison =
        `${numericExpression} < ${placeholder}::numeric`;
      break;

    default:
      throw new BadRequestError(
        `Condition "${filter.condition}" is not supported for custom number fields`,
      );
  }

  return buildCustomExistsClause(
    fieldPlaceholder,
    tenantPlaceholder,
    comparison,
  );
}

function buildCustomBooleanClause(
  filter: LeadFilter,
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  parameters: SqlParameterBuilder,
): string {
  const normalizedValue =
    requireFilterValue(filter).toLowerCase();

  const placeholder =
    parameters.add(normalizedValue);

  return buildCustomExistsClause(
    fieldPlaceholder,
    tenantPlaceholder,
    `LOWER(BTRIM(custom_value.value)) = ${placeholder}`,
  );
}

function buildCustomDateClause(
  filter: LeadFilter,
  fieldPlaceholder: string,
  tenantPlaceholder: string,
  parameters: SqlParameterBuilder,
): string {
  if (filter.condition === "is empty") {
    return buildCustomNotExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  if (filter.condition === "is not empty") {
    return buildCustomExistsClause(
      fieldPlaceholder,
      tenantPlaceholder,
      `COALESCE(BTRIM(custom_value.value), '') <> ''`,
    );
  }

  const placeholder = parameters.add(
    requireFilterValue(filter),
  );

  /*
   * The regex prevents obviously malformed strings from
   * entering the date conversion.
   *
   * The TO_CHAR comparison also rejects normalized invalid
   * dates such as 2026-02-31.
   */
  const dateExpression = `
    CASE
      WHEN BTRIM(custom_value.value) ~
        '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        AND TO_CHAR(
          TO_DATE(
            BTRIM(custom_value.value),
            'YYYY-MM-DD'
          ),
          'YYYY-MM-DD'
        ) = BTRIM(custom_value.value)
      THEN TO_DATE(
        BTRIM(custom_value.value),
        'YYYY-MM-DD'
      )
      ELSE NULL
    END
  `;

  let comparison: string;

  switch (filter.condition) {
    case "is":
      comparison =
        `${dateExpression} = ${placeholder}::date`;
      break;

    case "before":
      comparison =
        `${dateExpression} < ${placeholder}::date`;
      break;

    case "after":
      comparison =
        `${dateExpression} > ${placeholder}::date`;
      break;

    default:
      throw new BadRequestError(
        `Condition "${filter.condition}" is not supported for custom date fields`,
      );
  }

  return buildCustomExistsClause(
    fieldPlaceholder,
    tenantPlaceholder,
    comparison,
  );
}

function buildCustomFilterClause(
  filter: LeadFilter,
  tenantId: string,
  customFields: Map<
    string,
    CustomFieldDefinition
  >,
  parameters: SqlParameterBuilder,
): string {
  const definition =
    customFields.get(filter.fieldId);

  if (!definition) {
    throw new BadRequestError(
      `Custom field "${filter.fieldId}" was not loaded`,
    );
  }

  const fieldPlaceholder =
    parameters.add(definition.id);

  const tenantPlaceholder =
    parameters.add(tenantId);

  switch (definition.type) {
    case "string":
      return buildCustomStringClause(
        filter,
        fieldPlaceholder,
        tenantPlaceholder,
        parameters,
      );

    case "number":
      return buildCustomNumberClause(
        filter,
        fieldPlaceholder,
        tenantPlaceholder,
        parameters,
      );

    case "boolean":
      return buildCustomBooleanClause(
        filter,
        fieldPlaceholder,
        tenantPlaceholder,
        parameters,
      );

    case "date":
      return buildCustomDateClause(
        filter,
        fieldPlaceholder,
        tenantPlaceholder,
        parameters,
      );
  }
}

export function buildLeadFilterClause(
  input: BuildFilterClauseInput,
): string | null {
  if (input.filters.length === 0) {
    return null;
  }

  const clauses = input.filters.map(
    (filter) => {
      if (isSystemFieldId(filter.fieldId)) {
        return buildSystemFilterClause(
          filter,
          input.parameters,
        );
      }

      return buildCustomFilterClause(
        filter,
        input.tenantId,
        input.customFields,
        input.parameters,
      );
    },
  );

  /*
   * Parentheses preserve the requested filter grouping:
   *
   * tenant AND search AND (filter1 OR filter2)
   *
   * Without these parentheses, OR filters could escape
   * tenant or visibility restrictions.
   */
  return `(
    ${clauses.join(`\n${input.logic} `)}
  )`;
}