import "dotenv/config";

import type { PoolClient } from "pg";

import { pool } from "./client.js";

/**
 * Fixed UUIDs make the seed deterministic.
 * Reviewers can copy these IDs directly into curl/Postman requests.
 */

const ids = {
  tenantA: "10000000-0000-4000-8000-000000000001",
  tenantB: "10000000-0000-4000-8000-000000000002",

  adminA: "20000000-0000-4000-8000-000000000001",
  agentA1: "20000000-0000-4000-8000-000000000002",
  agentA2: "20000000-0000-4000-8000-000000000003",

  adminB: "20000000-0000-4000-8000-000000000004",
  agentB1: "20000000-0000-4000-8000-000000000005",

  leadA1: "30000000-0000-4000-8000-000000000001",
  leadA2: "30000000-0000-4000-8000-000000000002",
  leadA3: "30000000-0000-4000-8000-000000000003",
  leadA4: "30000000-0000-4000-8000-000000000004",
  leadA5: "30000000-0000-4000-8000-000000000005",

  leadB1: "30000000-0000-4000-8000-000000000006",
  leadB2: "30000000-0000-4000-8000-000000000007",

  cityFieldA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cityFieldB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const leads = [
  {
    id: ids.leadA1,
    tenantId: ids.tenantA,
    userId: ids.agentA1,
    name: "Ram Kumar",
    phone: "9000000001",
    countryCode: "+91",
    e164: "+919000000001",
    email: "ram@example.com",
    assignedTo: ids.agentA1,
    followUpDate: "2026-08-10",
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
  },
  {
    id: ids.leadA2,
    tenantId: ids.tenantA,
    userId: ids.agentA1,
    name: "Ramesh",
    phone: "9000000002",
    countryCode: "+91",
    e164: "+919000000002",
    email: "ramesh@example.com",
    assignedTo: ids.agentA1,
    followUpDate: "2026-07-01",
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
  },
  {
    id: ids.leadA3,
    tenantId: ids.tenantA,
    userId: ids.agentA2,
    name: "Priya",
    phone: "9000000003",
    countryCode: "+91",
    e164: "+919000000003",
    email: "priya@example.com",
    assignedTo: ids.agentA2,
    followUpDate: null,
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
  },
  {
    id: ids.leadA4,
    tenantId: ids.tenantA,
    userId: ids.adminA,
    name: "Anand",
    phone: "9000000004",
    countryCode: "+91",
    e164: "+919000000004",
    email: null,
    assignedTo: null,
    followUpDate: "2026-08-15",
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
  },
  {
    id: ids.leadA5,
    tenantId: ids.tenantA,
    userId: ids.agentA2,
    name: "Sita",
    phone: "9000000005",
    countryCode: "+91",
    e164: "+919000000005",
    email: "sita@example.com",
    assignedTo: ids.agentA2,
    followUpDate: "2026-08-01",
    createdAt: "2026-07-16T10:00:00.000Z",
    updatedAt: "2026-07-16T10:00:00.000Z",
  },

  /**
   * Tenant B intentionally contains values such as "Ram" and "Chennai".
   * These records help prove that tenant filtering works even when the
   * search/filter conditions also match another tenant's data.
   */
  {
    id: ids.leadB1,
    tenantId: ids.tenantB,
    userId: ids.agentB1,
    name: "Ram B",
    phone: "8000000001",
    countryCode: "+91",
    e164: "+918000000001",
    email: "ram.b@example.com",
    assignedTo: ids.agentB1,
    followUpDate: "2026-08-10",
    createdAt: "2026-07-20T11:00:00.000Z",
    updatedAt: "2026-07-20T11:00:00.000Z",
  },
  {
    id: ids.leadB2,
    tenantId: ids.tenantB,
    userId: ids.adminB,
    name: "Meera B",
    phone: "8000000002",
    countryCode: "+91",
    e164: "+918000000002",
    email: "meera.b@example.com",
    assignedTo: null,
    followUpDate: null,
    createdAt: "2026-07-19T11:00:00.000Z",
    updatedAt: "2026-07-19T11:00:00.000Z",
  },
];

const customFields = [
  {
    id: ids.cityFieldA,
    tenantId: ids.tenantA,
    label: "City",
    type: "string",
    status: true,
  },
  {
    id: ids.cityFieldB,
    tenantId: ids.tenantB,
    label: "City",
    type: "string",
    status: true,
  },
];

const customFieldValues = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    leadId: ids.leadA1,
    fieldId: ids.cityFieldA,
    value: "Chennai",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    leadId: ids.leadA2,
    fieldId: ids.cityFieldA,
    value: "Madurai",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    leadId: ids.leadA3,
    fieldId: ids.cityFieldA,
    value: "Chennai",
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    leadId: ids.leadA4,
    fieldId: ids.cityFieldA,
    value: "Coimbatore",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    leadId: ids.leadA5,
    fieldId: ids.cityFieldA,
    value: "Chennai",
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    leadId: ids.leadB1,
    fieldId: ids.cityFieldB,
    value: "Chennai",
  },
  {
    id: "40000000-0000-4000-8000-000000000007",
    leadId: ids.leadB2,
    fieldId: ids.cityFieldB,
    value: "Kochi",
  },
];

async function clearExistingSeedData(
  client: PoolClient,
): Promise<void> {
  const tenantIds = [ids.tenantA, ids.tenantB];

  /*
   * Delete child rows first because lead_custom_field_values contains
   * foreign keys to both leads and custom_fields.
   *
   * Cleanup is restricted to these two seed tenants instead of
   * truncating the entire database.
   */
  await client.query(
    `
      DELETE FROM lead_custom_field_values AS value
      USING leads AS lead, custom_fields AS field
      WHERE value.lead_id = lead.id
        AND value.field_id = field.id
        AND (
          lead.tenant_id = ANY($1::uuid[])
          OR field.tenant_id = ANY($1::uuid[])
        )
    `,
    [tenantIds],
  );

  await client.query(
    `
      DELETE FROM custom_fields
      WHERE tenant_id = ANY($1::uuid[])
    `,
    [tenantIds],
  );

  await client.query(
    `
      DELETE FROM leads
      WHERE tenant_id = ANY($1::uuid[])
    `,
    [tenantIds],
  );
}

async function insertLeads(client: PoolClient): Promise<void> {
  for (const lead of leads) {
    await client.query(
      `
        INSERT INTO leads (
          id,
          tenant_id,
          user_id,
          name,
          phone,
          country_code,
          e164,
          email,
          assigned_to,
          follow_up_date,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
      `,
      [
        lead.id,
        lead.tenantId,
        lead.userId,
        lead.name,
        lead.phone,
        lead.countryCode,
        lead.e164,
        lead.email,
        lead.assignedTo,
        lead.followUpDate,
        lead.createdAt,
        lead.updatedAt,
      ],
    );
  }
}

async function insertCustomFields(
  client: PoolClient,
): Promise<void> {
  for (const field of customFields) {
    await client.query(
      `
        INSERT INTO custom_fields (
          id,
          tenant_id,
          label,
          type,
          status
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        field.id,
        field.tenantId,
        field.label,
        field.type,
        field.status,
      ],
    );
  }
}

async function insertCustomFieldValues(
  client: PoolClient,
): Promise<void> {
  for (const customValue of customFieldValues) {
    await client.query(
      `
        INSERT INTO lead_custom_field_values (
          id,
          lead_id,
          field_id,
          value
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        customValue.id,
        customValue.leadId,
        customValue.fieldId,
        customValue.value,
      ],
    );
  }
}

async function seedDatabase(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await clearExistingSeedData(client);
    await insertLeads(client);
    await insertCustomFields(client);
    await insertCustomFieldValues(client);

    await client.query("COMMIT");

    console.log("Database seeded successfully.");
    console.log("");
    console.log("Tenant A:", ids.tenantA);
    console.log("Tenant A admin:", ids.adminA);
    console.log("Tenant A agent A1:", ids.agentA1);
    console.log("Tenant A agent A2:", ids.agentA2);
    console.log("Tenant A City field:", ids.cityFieldA);
    console.log("");
    console.log("Tenant B:", ids.tenantB);
    console.log("Tenant B admin:", ids.adminB);
    console.log("Tenant B agent B1:", ids.agentB1);
    console.log("Tenant B City field:", ids.cityFieldB);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  try {
    await seedDatabase();
  } catch (error) {
    console.error("Failed to seed database:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();