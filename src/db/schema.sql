BEGIN;

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    name VARCHAR(150) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    country_code VARCHAR(10) NOT NULL,
    e164 VARCHAR(40) NOT NULL,
    email VARCHAR(255),

    assigned_to UUID,
    follow_up_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id UUID NOT NULL,
    label VARCHAR(100) NOT NULL,

    type VARCHAR(20) NOT NULL
        CHECK (type IN ('string', 'number', 'date', 'boolean')),

    status BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE lead_custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    lead_id UUID NOT NULL
        REFERENCES leads(id)
        ON DELETE CASCADE,

    field_id UUID NOT NULL
        REFERENCES custom_fields(id)
        ON DELETE CASCADE,

    value TEXT,

    CONSTRAINT unique_lead_custom_field
        UNIQUE (lead_id, field_id)
);

-- Helps tenant-scoped pagination and createdAt sorting.
CREATE INDEX idx_leads_tenant_created_at
    ON leads (tenant_id, created_at DESC);

-- Helps enforce agent visibility efficiently.
CREATE INDEX idx_leads_tenant_assigned_to
    ON leads (tenant_id, assigned_to);

-- Helps filtering and sorting by follow-up date.
CREATE INDEX idx_leads_tenant_follow_up_date
    ON leads (tenant_id, follow_up_date);

-- Helps locate custom-field definitions belonging to a tenant.
CREATE INDEX idx_custom_fields_tenant
    ON custom_fields (tenant_id);

-- Helps EAV filters that start with a field ID.
CREATE INDEX idx_custom_field_values_field_lead
    ON lead_custom_field_values (field_id, lead_id);

COMMIT;