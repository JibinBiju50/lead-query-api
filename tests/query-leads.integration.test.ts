import assert from "node:assert/strict";
import { after, test } from "node:test";

import request from "supertest";

import app from "../src/app.js";
import { pool } from "../src/db/client.js";

const ids = {
  tenantA: "10000000-0000-4000-8000-000000000001",
  tenantB: "10000000-0000-4000-8000-000000000002",

  adminA: "20000000-0000-4000-8000-000000000001",
  agentA1: "20000000-0000-4000-8000-000000000002",
  agentA2: "20000000-0000-4000-8000-000000000003",

  cityFieldA: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cityFieldB: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const adminHeaders = {
  "x-tenant-id": ids.tenantA,
  "x-user-id": ids.adminA,
  "x-user-role": "admin",
};

const agentA1Headers = {
  "x-tenant-id": ids.tenantA,
  "x-user-id": ids.agentA1,
  "x-user-role": "agent",
};

type RequestHeaders = Record<string, string>;

type QueryRequestInput = {
  headers?: RequestHeaders;
  queryString?: string;
  body?: unknown;
};

function sorted(values: string[]): string[] {
  return [...values].sort();
}

async function queryLeads({
  headers = adminHeaders,
  queryString = "",
  body = {},
}: QueryRequestInput = {}) {
  return request(app)
    .post(`/api/v1/leads/query${queryString}`)
    .set(headers)
    .set("content-type", "application/json")
    .send(body);
}

/*
 * The PostgreSQL pool keeps open connections.
 * Closing it allows the test process to exit cleanly.
 */
after(async () => {
  await pool.end();
});

test("returns 401 when authentication headers are missing", async () => {
  const response = await request(app)
    .post("/api/v1/leads/query")
    .send({});

  assert.equal(response.status, 401);
  assert.equal(response.body.statusCode, 401);
});

test("admin sees all leads from Tenant A and no Tenant B leads", async () => {
  const response = await queryLeads();

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.totalRecords, 5);
  assert.equal(response.body.meta.totalPages, 1);

  const names = response.body.data.map(
    (lead: { name: string }) => lead.name,
  );

  assert.deepEqual(
    sorted(names),
    sorted([
      "Ram Kumar",
      "Ramesh",
      "Priya",
      "Anand",
      "Sita",
    ]),
  );

  /*
   * This is stronger than checking only the lead count.
   * Every returned row must belong to the authenticated tenant.
   */
  for (const lead of response.body.data) {
    assert.equal(lead.tenantId, ids.tenantA);
    assert.notEqual(lead.tenantId, ids.tenantB);
  }
});

test("Agent A1 sees only leads assigned to Agent A1", async () => {
  const response = await queryLeads({
    headers: agentA1Headers,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.totalRecords, 2);

  const names = response.body.data.map(
    (lead: { name: string }) => lead.name,
  );

  assert.deepEqual(
    sorted(names),
    sorted(["Ram Kumar", "Ramesh"]),
  );

  for (const lead of response.body.data) {
    assert.equal(lead.assignedTo, ids.agentA1);
    assert.equal(lead.tenantId, ids.tenantA);
  }
});

test("City contains Chennai AND assignedTo Agent A2 returns Priya and Sita", async () => {
  const response = await queryLeads({
    body: {
      logic: "AND",
      filters: [
        {
          fieldId: ids.cityFieldA,
          fieldType: "string",
          condition: "contain",
          value: "Chennai",
        },
        {
          fieldId: "assignedTo",
          fieldType: "string",
          condition: "is",
          value: ids.agentA2,
          inputType: "multiselect",
        },
      ],
    },
  });

  assert.equal(response.status, 200);

  const names = response.body.data.map(
    (lead: { name: string }) => lead.name,
  );

  assert.deepEqual(
    sorted(names),
    sorted(["Priya", "Sita"]),
  );
});

test("name contains Ram OR name contains Sita returns three matching leads", async () => {
  const response = await queryLeads({
    body: {
      logic: "OR",
      filters: [
        {
          fieldId: "name",
          fieldType: "string",
          condition: "contain",
          value: "Ram",
        },
        {
          fieldId: "name",
          fieldType: "string",
          condition: "contain",
          value: "Sita",
        },
      ],
    },
  });

  assert.equal(response.status, 200);

  const names = response.body.data.map(
    (lead: { name: string }) => lead.name,
  );

  /*
   * "Ramesh" contains "Ram", so it should also match.
   */
  assert.deepEqual(
    sorted(names),
    sorted(["Ram Kumar", "Ramesh", "Sita"]),
  );
});

test("free-text phone search finds Priya", async () => {
  const response = await queryLeads({
    body: {
      q: "9000000003",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].name, "Priya");
  assert.equal(
    response.body.data[0].phone,
    "9000000003",
  );
});

test("free-text search is combined with structured filters using AND", async () => {
  const response = await queryLeads({
    body: {
      q: "Ram",
      logic: "OR",
      filters: [
        {
          fieldId: ids.cityFieldA,
          fieldType: "string",
          condition: "is",
          value: "Madurai",
        },
      ],
    },
  });

  assert.equal(response.status, 200);

  /*
   * Both Ram Kumar and Ramesh match q=Ram.
   * Only Ramesh also has City=Madurai.
   */
  assert.deepEqual(
    response.body.data.map(
      (lead: { name: string }) => lead.name,
    ),
    ["Ramesh"],
  );
});

test("assignedTo multiselect returns the union of both agents' leads", async () => {
  const response = await queryLeads({
    body: {
      filters: [
        {
          fieldId: "assignedTo",
          fieldType: "string",
          condition: "is",
          value: `${ids.agentA1},${ids.agentA2}`,
          inputType: "multiselect",
        },
      ],
    },
  });

  assert.equal(response.status, 200);

  const names = response.body.data.map(
    (lead: { name: string }) => lead.name,
  );

  assert.deepEqual(
    sorted(names),
    sorted([
      "Ram Kumar",
      "Ramesh",
      "Priya",
      "Sita",
    ]),
  );

  /*
   * Anand is unassigned, so he should not match either agent.
   */
  assert.equal(names.includes("Anand"), false);
});

test("invalid condition for name returns 400", async () => {
  const response = await queryLeads({
    body: {
      filters: [
        {
          fieldId: "name",
          fieldType: "string",
          condition: "greater than",
          value: "10",
        },
      ],
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.statusCode, 400);
  assert.match(
    response.body.message,
    /not supported/i,
  );
});

test("page 2 with limit 2 returns the correct slice and metadata", async () => {
  const response = await queryLeads({
    queryString:
      "?page=2&limit=2&sortBy=createdAt&sortDirection=desc",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 2);

  assert.deepEqual(
    response.body.data.map(
      (lead: { name: string }) => lead.name,
    ),
    ["Priya", "Anand"],
  );

  assert.deepEqual(response.body.meta, {
    page: 2,
    limit: 2,
    totalRecords: 5,
    totalPages: 3,
  });
});

test("returned leads include hydrated custom fields", async () => {
  const response = await queryLeads({
    body: {
      q: "Ram Kumar",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);

  const lead = response.body.data[0];

  assert.ok(Array.isArray(lead.customFields));
  assert.equal(lead.customFields.length, 1);

  assert.deepEqual(lead.customFields[0], {
    fieldId: ids.cityFieldA,
    label: "City",
    value: "Chennai",
  });
});

test("Tenant A cannot use Tenant B's custom-field definition", async () => {
  const response = await queryLeads({
    body: {
      filters: [
        {
          fieldId: ids.cityFieldB,
          fieldType: "string",
          condition: "contain",
          value: "Chennai",
        },
      ],
    },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.statusCode, 400);

  assert.match(
    response.body.message,
    /not found for the current tenant/i,
  );
});

test("search input is treated as data and cannot alter the SQL query", async () => {
  const response = await queryLeads({
    body: {
      q: "' OR 1=1 --",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 0);
  assert.equal(response.body.meta.totalRecords, 0);
});