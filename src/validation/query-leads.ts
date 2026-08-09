import { z } from "zod";

import {
  filterConditions,
  filterFieldTypes,
  filterLogicValues,
  isSystemFieldId,
  systemFieldTypes,
  type FilterCondition,
  type FilterFieldType,
} from "../types/lead-filter.js";

const emptyConditions = [
  "is empty",
  "is not empty",
] as const;

const stringConditions: readonly FilterCondition[] = [
  "is",
  "is not",
  "contain",
  "does not contain",
  "starts with",
  "ends with",
  "is empty",
  "is not empty",
];

const dateConditions: readonly FilterCondition[] = [
  "is",
  "before",
  "after",
  "is empty",
  "is not empty",
];

const numberConditions: readonly FilterCondition[] = [
  "is",
  "greater than",
  "less than",
  "is empty",
  "is not empty",
];

const booleanConditions: readonly FilterCondition[] = [
  "is",
];

const assignedToConditions: readonly FilterCondition[] = [
  "is",
  "is not",
  "contain",
  "does not contain",
  "is empty",
  "is not empty",
];

const createdByConditions: readonly FilterCondition[] = [
  "is",
  "is not",
  "contain",
  "does not contain",
];

const conditionsByFieldType: Record<
  FilterFieldType,
  readonly FilterCondition[]
> = {
  string: stringConditions,
  number: numberConditions,
  date: dateConditions,
  boolean: booleanConditions,
};

function isEmptyCondition(
  condition: FilterCondition,
): boolean {
  return (
    emptyConditions as readonly FilterCondition[]
  ).includes(condition);
}

/**
 * Checks both the YYYY-MM-DD structure and whether the date
 * actually exists. For example, 2026-02-31 is rejected.
 */
function isValidDateOnly(value: string): boolean {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isUuid(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

export const queryLeadsQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("page must be an integer")
    .min(1, "page must be at least 1")
    .default(1),

  limit: z.coerce
    .number()
    .int("limit must be an integer")
    .min(1, "limit must be at least 1")
    .max(100, "limit must not exceed 100")
    .default(20),

  sortBy: z
    .enum(["createdAt", "followUpDate"], {
      error:
        'sortBy must be "createdAt" or "followUpDate"',
    })
    .default("createdAt"),

  sortDirection: z
    .enum(["asc", "desc"], {
      message:
        'sortDirection must be "asc" or "desc"',
    })
    .default("desc"),
});

export const leadFilterSchema = z
  .object({
    fieldId: z
      .string()
      .trim()
      .min(1, "fieldId is required"),

    fieldType: z.enum(filterFieldTypes),

    condition: z.enum(filterConditions),

    value: z.string().optional(),

    /**
     * The assignment allows text, select, multiselect,
     * or another string value.
     */
    inputType: z.string().optional(),
  })
  .superRefine((filter, context) => {
    const {
      fieldId,
      fieldType,
      condition,
      value,
    } = filter;

    /*
     * System fields must use the expected type.
     * For example, name cannot claim fieldType: "number".
     */
    if (isSystemFieldId(fieldId)) {
      const expectedType = systemFieldTypes[fieldId];

      if (fieldType !== expectedType) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fieldType"],
          message:
            `${fieldId} must use fieldType ` +
            `"${expectedType}"`,
        });

        return;
      }
    } else if (!isUuid(fieldId)) {
      /*
       * A non-system field is interpreted as a
       * custom-field UUID.
       */
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fieldId"],
        message:
          "Custom fieldId must be a valid UUID",
      });
    }

    let allowedConditions =
      conditionsByFieldType[fieldType];

    if (fieldId === "assignedTo") {
      allowedConditions = assignedToConditions;
    }

    if (fieldId === "createdBy") {
      allowedConditions = createdByConditions;
    }

    if (!allowedConditions.includes(condition)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message:
          `Condition "${condition}" is not supported ` +
          `for field "${fieldId}"`,
      });

      return;
    }

    /*
     * Only empty-check conditions may omit value.
     */
    if (!isEmptyCondition(condition)) {
      if (
        value === undefined ||
        value.trim().length === 0
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message:
            `value is required for condition ` +
            `"${condition}"`,
        });

        return;
      }
    }

    if (
      fieldType === "date" &&
      !isEmptyCondition(condition) &&
      value !== undefined &&
      !isValidDateOnly(value.trim())
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message:
          "Date value must be a valid YYYY-MM-DD date",
      });
    }

    if (
      fieldType === "number" &&
      !isEmptyCondition(condition) &&
      value !== undefined
    ) {
      const numericValue = Number(value.trim());

      if (!Number.isFinite(numericValue)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message:
            "Number filter value must be a valid number",
        });
      }
    }

    if (
      fieldType === "boolean" &&
      value !== undefined
    ) {
      const booleanValue =
        value.trim().toLowerCase();

      if (
        booleanValue !== "true" &&
        booleanValue !== "false"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message:
            'Boolean filter value must be "true" or "false"',
        });
      }
    }

    /*
     * assignedTo and createdBy values must contain
     * one or more comma-separated UUIDs.
     */
    if (
      (fieldId === "assignedTo" ||
        fieldId === "createdBy") &&
      !isEmptyCondition(condition) &&
      value !== undefined
    ) {
      const userIds = value
        .split(",")
        .map((userId) => userId.trim())
        .filter(Boolean);

      if (
        userIds.length === 0 ||
        userIds.some((userId) => !isUuid(userId))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["value"],
          message:
            `${fieldId} value must contain valid ` +
            "comma-separated UUIDs",
        });
      }
    }
  });

export const queryLeadsBodySchema = z.object({
  q: z.string().trim().optional(),

  logic: z
    .enum(filterLogicValues)
    .default("AND"),

  filters: z
    .array(leadFilterSchema)
    .default([]),
});

export type QueryLeadsQuery = z.infer<
  typeof queryLeadsQuerySchema
>;

export type QueryLeadsBody = z.infer<
  typeof queryLeadsBodySchema
>;