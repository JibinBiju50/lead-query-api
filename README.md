# Lead Filter Query API

Express + TypeScript + PostgreSQL implementation of the multi-tenant lead query take-home.

## Tech stack

- Node.js 20+
- Express
- TypeScript using native ES modules
- PostgreSQL
- `pg` for parameterized SQL
- Zod for request validation
- Supertest and Node's built-in test runner for integration tests   

## Setup and Run

### 1. Install dependencies

```bash
npm install
```

Create a `.env` file using your local PostgreSQL configuration:

```env
PORT=3000
PGHOST=localhost
PGPORT=your_database_port_number
PGDATABASE=your_database_name
PGUSER=your_database_user
PGPASSWORD=your_database_password
```

Do not commit real credentials. Keep only placeholder values in `.env.example`.

### 2. Create the database and apply the schema

Create a PostgreSQL database, then run:

```bash
psql -d your_database_name -f src/db/schema.sql
```

Alternatively, execute `src/db/schema.sql` from pgAdmin Query Tool.

The project uses a SQL schema file instead of a migration framework as a time-boxed shortcut for this take-home.

### 3. Seed the database

```bash
npm run seed
```

The seed creates two tenants and fixed UUIDs so the API can be tested consistently.

Useful Tenant A IDs:

```text
Tenant A:       10000000-0000-4000-8000-000000000001
Admin A:        20000000-0000-4000-8000-000000000001
Agent A1:       20000000-0000-4000-8000-000000000002
Agent A2:       20000000-0000-4000-8000-000000000003
City field:     aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
```

### 4. Run the server

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Optional verification:

```bash
npm test
```

---

## Example Requests

### 1. Admin: City contains Chennai AND assigned to Agent A2

```bash
curl -X POST "http://localhost:3000/api/v1/leads/query?page=1&limit=20&sortBy=createdAt&sortDirection=desc" \
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

Expected leads: `Priya`, `Sita`.

### 2. Agent A1: free-text search

```bash
curl -X POST "http://localhost:3000/api/v1/leads/query" \
  -H "content-type: application/json" \
  -H "x-tenant-id: 10000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 20000000-0000-4000-8000-000000000002" \
  -H "x-user-role: agent" \
  -d '{"q":"Ram"}'
```

Agent A1 only receives matching leads assigned to Agent A1.

### 3. Admin: OR filter

```bash
curl -X POST "http://localhost:3000/api/v1/leads/query" \
  -H "content-type: application/json" \
  -H "x-tenant-id: 10000000-0000-4000-8000-000000000001" \
  -H "x-user-id: 20000000-0000-4000-8000-000000000001" \
  -H "x-user-role: admin" \
  -d '{
    "logic": "OR",
    "filters": [
      {"fieldId":"name","fieldType":"string","condition":"contain","value":"Ram"},
      {"fieldId":"name","fieldType":"string","condition":"contain","value":"Sita"}
    ]
  }'
```

Expected leads: `Ram Kumar`, `Ramesh`, `Sita`.

---

## Design Decisions and Trade-offs

- **Database access:** Used raw parameterized SQL with `pg` instead of an ORM. Dynamic filter compilation and EAV `EXISTS` queries are easier to review directly in SQL.
- **Tenant isolation:** Every lead query is scoped by `tenant_id`. Agents additionally receive only leads where `assigned_to` matches their user ID.
- **Custom fields:** Custom-field filters use correlated `EXISTS` / `NOT EXISTS` queries to avoid duplicate lead rows that could break pagination or counts.
- **Custom-field validation:** Custom-field definitions are checked against the authenticated tenant, and the database field type is treated as the source of truth rather than trusting `fieldType` from the request.
- **Empty custom-field semantics:** `is empty` means the EAV row is missing or its value is null/blank. `is not empty` requires a non-empty value. For negative conditions such as `is not` and `does not contain`, a missing custom-field value counts as a match.
- **Query safety:** Request values use PostgreSQL parameters. Sort columns/directions are chosen only from validated server-side allowlists.
- **Pagination:** Matching rows are counted separately, then the requested page is fetched. Custom fields for returned leads are hydrated in one additional query to avoid N+1 queries.
- **Shortcut:** Used `schema.sql` instead of a migration library. The bonus ID-then-hydrate pattern, custom EAV multiselect exact-match semantics, and OpenAPI documentation were not implemented.

---

## Time Spent

Approximate time spent: **[replace with your actual time]**.

This includes project setup, database schema and seed data, authentication and validation, query/filter implementation, debugging, integration testing, and documentation.

## What I Would Improve With Another Day

- Add versioned database migrations and a dedicated test database setup.
- Add focused unit tests for SQL clause builders and more custom number/date/boolean edge cases.
- Implement the bonus ID-then-hydrate query pattern and compare query plans.
- Add OpenAPI documentation and run `EXPLAIN ANALYZE` on representative filter queries to tune indexes.
