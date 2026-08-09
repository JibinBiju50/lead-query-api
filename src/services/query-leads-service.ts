import { pool } from "../db/client.js";
import {
    loadCustomFieldDefinitions,
} from "./custom-fields.js";
import type { CurrentUser } from "../types/current-user.js";
import type {
    QueryLeadsBody,
    QueryLeadsQuery,
} from "../validation/query-leads.js";
import {
    buildLeadWhereClause,
} from "./build-lead-where-clause.js";

type QueryLeadsServiceInput = {
    currentUser: CurrentUser;
    query: QueryLeadsQuery;
    body: QueryLeadsBody;
};

type LeadRow = {
    id: string;
    tenantId: string;
    userId: string;
    name: string;
    phone: string;
    countryCode: string;
    e164: string;
    email: string | null;
    assignedTo: string | null;
    followUpDate: string | null;
    createdAt: Date;
    updatedAt: Date;
};

type CustomFieldRow = {
    leadId: string;
    fieldId: string;
    label: string;
    value: string | null;
};

type LeadCustomField = {
    fieldId: string;
    label: string;
    value: string | null;
};

type HydratedLead = LeadRow & {
    customFields: LeadCustomField[];
};

type QueryLeadsResult = {
    leads: HydratedLead[];
    meta: {
        page: number;
        limit: number;
        totalRecords: number;
        totalPages: number;
    };
};

const sortColumns: Record<
    QueryLeadsQuery["sortBy"],
    string
> = {
    createdAt: "lead.created_at",
    followUpDate: "lead.follow_up_date",
};

async function hydrateCustomFields(
    leads: LeadRow[],
    tenantId: string,
): Promise<HydratedLead[]> {
    if (leads.length === 0) {
        return [];
    }

    const leadIds = leads.map((lead) => lead.id);

    /*
     * Fetch custom fields for all returned leads in one query.
     *
     * This avoids the N+1 pattern:
     *   1 query for leads
     *   then 1 additional query for each lead
     */
    const customFieldResult =
        await pool.query<CustomFieldRow>(
            `
        SELECT
          value.lead_id AS "leadId",
          field.id AS "fieldId",
          field.label,
          value.value
        FROM lead_custom_field_values AS value
        INNER JOIN custom_fields AS field
          ON field.id = value.field_id
        WHERE value.lead_id = ANY($1::uuid[])
          AND field.tenant_id = $2
          AND field.status = TRUE
        ORDER BY value.lead_id, field.label
      `,
            [leadIds, tenantId],
        );

    const fieldsByLeadId = new Map<
        string,
        LeadCustomField[]
    >();

    for (const row of customFieldResult.rows) {
        const existingFields =
            fieldsByLeadId.get(row.leadId) ?? [];

        existingFields.push({
            fieldId: row.fieldId,
            label: row.label,
            value: row.value,
        });

        fieldsByLeadId.set(
            row.leadId,
            existingFields,
        );
    }

    return leads.map((lead) => ({
        ...lead,
        customFields:
            fieldsByLeadId.get(lead.id) ?? [],
    }));
}

export async function queryLeadsService(
    input: QueryLeadsServiceInput,
): Promise<QueryLeadsResult> {
    const {
        currentUser,
        query,
        body,
    } = input;

    const customFields =
        await loadCustomFieldDefinitions(
            body.filters,
            currentUser.tenantId,
        );

    const whereClause = buildLeadWhereClause({
        currentUser,
        q: body.q,
        filters: body.filters,
        logic: body.logic,
        customFields,
    });

    const countResult = await pool.query<{
        totalRecords: string;
    }>(
        `
      SELECT
        COUNT(*) AS "totalRecords"
      FROM leads AS lead
      ${whereClause.sql}
    `,
        whereClause.values,
    );

    /*
     * PostgreSQL returns COUNT(*) as a string because it uses
     * the bigint type. Convert it before calculating pages.
     */
    const totalRecords = Number(
        countResult.rows[0]?.totalRecords ?? 0,
    );

    const offset =
        (query.page - 1) * query.limit;

    /*
     * SQL values such as tenant ID, search text, limit, and
     * offset can use parameters.
     *
     * SQL identifiers such as column names cannot be passed
     * as $1. Therefore sortBy is mapped through a fixed
     * allowlist instead of being inserted directly.
     */
    const sortColumn =
        sortColumns[query.sortBy];

    const sortDirection =
        query.sortDirection === "asc"
            ? "ASC"
            : "DESC";

    const limitPlaceholder =
        `$${whereClause.values.length + 1}`;

    const offsetPlaceholder =
        `$${whereClause.values.length + 2}`;

    const pageValues = [
        ...whereClause.values,
        query.limit,
        offset,
    ];

    const leadResult = await pool.query<LeadRow>(
        `
      SELECT
        lead.id,
        lead.tenant_id AS "tenantId",
        lead.user_id AS "userId",
        lead.name,
        lead.phone,
        lead.country_code AS "countryCode",
        lead.e164,
        lead.email,
        lead.assigned_to AS "assignedTo",
        lead.follow_up_date AS "followUpDate",
        lead.created_at AS "createdAt",
        lead.updated_at AS "updatedAt"
      FROM leads AS lead
      ${whereClause.sql}
      ORDER BY
        ${sortColumn} ${sortDirection} NULLS LAST,
        lead.id ASC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
    `,
        pageValues,
    );

    /*
     * lead.id is a secondary sort key. It keeps pagination
     * deterministic when multiple leads share the same date.
     */
    const hydratedLeads =
        await hydrateCustomFields(
            leadResult.rows,
            currentUser.tenantId,
        );

    return {
        leads: hydratedLeads,
        meta: {
            page: query.page,
            limit: query.limit,
            totalRecords,
            totalPages:
                totalRecords === 0
                    ? 0
                    : Math.ceil(
                        totalRecords / query.limit,
                    ),
        },
    };
}