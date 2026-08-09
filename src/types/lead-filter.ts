export const filterFieldTypes = [
  "string",
  "number",
  "date",
  "boolean",
] as const;

export type FilterFieldType =
  (typeof filterFieldTypes)[number];

export const filterConditions = [
  "is",
  "is not",
  "contain",
  "does not contain",
  "starts with",
  "ends with",
  "before",
  "after",
  "greater than",
  "less than",
  "is empty",
  "is not empty",
] as const;

export type FilterCondition =
  (typeof filterConditions)[number];

export const filterLogicValues = ["AND", "OR"] as const;

export type FilterLogic =
  (typeof filterLogicValues)[number];

/**
 * System fields map directly to columns in the leads table.
 * Any other fieldId must be a custom-field UUID.
 */
export const systemFieldTypes = {
  name: "string",
  phone: "string",
  email: "string",
  assignedTo: "string",
  createdBy: "string",
  followUpDate: "date",
  createdAt: "date",
  updatedAt: "date",
} as const satisfies Record<string, FilterFieldType>;

export type SystemFieldId =
  keyof typeof systemFieldTypes;

export function isSystemFieldId(
  fieldId: string,
): fieldId is SystemFieldId {
  return Object.prototype.hasOwnProperty.call(
    systemFieldTypes,
    fieldId,
  );
}