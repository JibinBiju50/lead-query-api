import { pool } from "../db/client.js";
import { BadRequestError } from "../errors.js";
import {
  isSystemFieldId,
  type FilterFieldType,
} from "../types/lead-filter.js";
import type {
  QueryLeadsBody,
} from "../validation/query-leads.js";

type LeadFilter = QueryLeadsBody["filters"][number];

type CustomFieldRow = {
  id: string;
  type: string;
  status: boolean;
};

export type CustomFieldDefinition = {
  id: string;
  type: FilterFieldType;
};

const validFieldTypes: readonly string[] = [
  "string",
  "number",
  "date",
  "boolean",
];

/**
 * Fetches all referenced custom-field definitions in one query.
 *
 * This prevents:
 * - one database query per filter;
 * - using a custom field belonging to another tenant;
 * - trusting the fieldType supplied by the client.
 */
export async function loadCustomFieldDefinitions(
  filters: LeadFilter[],
  tenantId: string,
): Promise<Map<string, CustomFieldDefinition>> {
  const customFieldIds = [
    ...new Set(
      filters
        .filter(
          (filter) =>
            !isSystemFieldId(filter.fieldId),
        )
        .map((filter) => filter.fieldId),
    ),
  ];

  if (customFieldIds.length === 0) {
    return new Map();
  }

  const result = await pool.query<CustomFieldRow>(
    `
      SELECT
        id,
        type,
        status
      FROM custom_fields
      WHERE tenant_id = $1
        AND id = ANY($2::uuid[])
    `,
    [tenantId, customFieldIds],
  );

  const rowsById = new Map(
    result.rows.map((row) => [row.id, row]),
  );

  const definitions = new Map<
    string,
    CustomFieldDefinition
  >();

  for (const filter of filters) {
    if (isSystemFieldId(filter.fieldId)) {
      continue;
    }

    const databaseField =
      rowsById.get(filter.fieldId);

    if (!databaseField) {
      throw new BadRequestError(
        `Custom field "${filter.fieldId}" was not found for the current tenant`,
      );
    }

    /*
     * The task says inactive fields may be ignored.
     * Rejecting them is clearer than silently ignoring a
     * filter and returning unexpected leads.
     */
    if (!databaseField.status) {
      throw new BadRequestError(
        `Custom field "${filter.fieldId}" is inactive`,
      );
    }

    if (
      !validFieldTypes.includes(
        databaseField.type,
      )
    ) {
      throw new BadRequestError(
        `Custom field "${filter.fieldId}" has an unsupported database type`,
      );
    }

    /*
     * Never trust fieldType from the request body.
     * The custom_fields table is the source of truth.
     */
    if (
      databaseField.type !== filter.fieldType
    ) {
      throw new BadRequestError(
        `Custom field "${filter.fieldId}" has type ` +
          `"${databaseField.type}", not ` +
          `"${filter.fieldType}"`,
      );
    }

    definitions.set(filter.fieldId, {
      id: databaseField.id,
      type:
        databaseField.type as FilterFieldType,
    });
  }

  return definitions;
}