# Lead Filter Query API

Backend take-home implementation for a multi-tenant CRM lead query service using Express, TypeScript, PostgreSQL, and Zod.

## Tech Stack

Node.js, Express.js, TypeScript, PostgreSQL, node-postgres (`pg`), Zod, Supertest, Neon, and Vercel.

## Setup

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file:

```env
DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>
PORT=3000
```

For a local PostgreSQL database, for example:

```env
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/lead_query_db
PORT=3000
```

### Create database schema

Create a PostgreSQL database, then run the SQL in:

```text
src/db/schema.sql
```

This creates:

- `leads`
- `custom_fields`
- `lead_custom_field_values`

### Seed

```bash
npm run seed
```

The seed uses fixed UUIDs so the API can be tested consistently.

Important seeded IDs:

```text
Tenant A:        10000000-0000-4000-8000-000000000001
Admin A:         20000000-0000-4000-8000-000000000001
Agent A1:        20000000-0000-4000-8000-000000000002
Agent A2:        20000000-0000-4000-8000-000000000003
Tenant A City:   aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

### Run locally

```bash
npm run dev
```

Local base URL:

```text
http://localhost:3000
```

Health check:

```text
GET /health
```

### Tests

```bash
npm test
```

---

## Example API Requests

Endpoint:

```text
POST /api/v1/leads/query
```

Replace `<BASE_URL>` with either:

```text
http://localhost:3000
```

or the deployed Vercel URL.

### 1. Admin — fetch Tenant A leads

```bash
curl -X POST "<BASE_URL>/api/v1/leads/query?page=1&limit=20" \
  -H "content-type: application/json" \
  -H "x-tenant-id: 10000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 20000000-0000-4000-8000-000000000001" \
  -H "x-user-role: admin" \
  -d '{}'
```

### 2. Agent A1 — fetch only assigned leads

```bash
curl -X POST "<BASE_URL>/api/v1/leads/query" \
  -H "content-type: application/json" \
  -H "x-tenant-id: 10000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 20000000-0000-4000-8000-000000000002" \
  -H "x-user-role: agent" \
  -d '{}'
```

Expected seeded leads: `Ram Kumar` and `Ramesh`.

### 3. City contains Chennai AND assigned to Agent A2

```bash
curl -X POST "<BASE_URL>/api/v1/leads/query" \
  -H "content-type: application/json" \
  -H "x-tenant-id: 10000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 20000000-0000-4000-8000-000000000001" \
  -H "x-user-role: admin" \
  -d '{
    "logic": "AND",
    "filters": [
      {
        "fieldId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "fieldType": "string",
        "condition": "contain",
        "value": "Chennai"
      },
      {
        "fieldId": "assignedTo",
        "fieldType": "string",
        "condition": "is",
        "value": "20000000-0000-4000-8000-000000000003",
        "inputType": "multiselect"
      }
    ]
  }'
```

Expected seeded leads: `Priya` and `Sita`.

---

## Design Decisions

- **Database access:** Used `pg` with parameterized SQL instead of an ORM. The task is heavily query-focused, and raw SQL makes the generated `WHERE`, `EXISTS`, sorting, and pagination logic explicit.
- **Tenant isolation:** Every lead query is scoped by `tenant_id`. Agents also receive an additional `assigned_to = current user` visibility condition.
- **Custom fields:** Stored using the provided EAV model. Custom-field filters use correlated `EXISTS` / `NOT EXISTS` subqueries so joins do not duplicate lead rows.
- **Custom-field ownership:** Referenced custom fields are checked against the authenticated tenant before being used in the lead query.
- **Empty custom values:** A custom field is treated as empty when no EAV row exists or its stored value is null/blank. Negative custom string filters also treat a missing value as not matching the searched value.
- **Pagination:** Matching rows are counted separately from the paginated fetch so `totalRecords` and `totalPages` describe the full filtered result.
- **Custom-field hydration:** Custom values for all leads in the returned page are fetched in one additional query to avoid N+1 queries.
- **SQL safety:** Request values are passed as PostgreSQL parameters. Sort columns and directions are selected from fixed allowlists rather than inserted directly from user input.
- **Authentication shortcut:** Authentication is intentionally simulated using the required request headers. No JWT, users table, or gateway authentication was added because those are outside the task scope.
- **Shortcut:** The optional ID-then-hydrate query pattern and OpenAPI/Swagger documentation were not implemented.

---

## Time Spent

Approximate time spent: **16–17 hours**.

This includes understanding the requirements, project and database setup, implementation, debugging, integration testing, deployment, and documentation.

With another day, I would:

- add focused unit tests for the filter SQL compiler in addition to the integration tests;
- implement the optional ID-then-hydrate query pattern;
- add OpenAPI/Swagger documentation;
- add more edge-case coverage for custom number, boolean, and date fields.
