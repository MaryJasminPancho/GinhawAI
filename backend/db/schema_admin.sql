-- Read this file as UTF-8 even when psql runs in a Windows console (which defaults to WIN1252).
SET client_encoding = 'UTF8';

-- Admin console, analytics and audit tables (manuscript Tables 12, 15–18)
-- plus a few supporting tables. Run AFTER schema.sql, schema_accounts.sql and
-- schema_localization.sql:
--   psql -U postgres -d ginhawai -f backend/db/schema_admin.sql
-- Safe to run more than once.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Localization additions
-- ---------------------------------------------------------------------------
-- Map coordinates for the Leaflet vulnerability heatmap (approximate centre point).
ALTER TABLE barangays ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE barangays ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Table 15: Barangay Schedules
CREATE TABLE IF NOT EXISTS barangay_schedules (
    schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id   UUID NOT NULL REFERENCES lgu_offices(office_id) ON DELETE CASCADE,
    program_id  UUID NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    notes       TEXT,
    CHECK (end_date >= start_date)
);

-- Table 16: Demand Logs — one row per program matched in an assessment, or one
-- row with program_id NULL when nothing matched (eligibility gap).
-- assessment_id is a random id (not linked to any person) so the number of
-- assessments can be counted without double-counting multi-program matches.
CREATE TABLE IF NOT EXISTS demand_logs (
    log_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id      UUID NOT NULL,
    program_id         UUID REFERENCES programs(program_id),
    barangay_code      VARCHAR(20) REFERENCES barangays(barangay_code) ON DELETE SET NULL,
    vulnerability_tier VARCHAR(20) NOT NULL CHECK (vulnerability_tier IN ('high', 'moderate', 'low')),
    event_timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_demand_logs_time ON demand_logs (event_timestamp);

-- Table 17: SMS Logs
CREATE TABLE IF NOT EXISTS sms_logs (
    sms_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    masked_recipient VARCHAR(20) NOT NULL,
    program_id       UUID NOT NULL REFERENCES programs(program_id),
    delivery_status  VARCHAR(20) NOT NULL,
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_logs_time ON sms_logs (sent_at);

-- Anonymized "do you already have this document?" answers from the citizen
-- checklist screen. Feeds the Document Deficiency Report.
CREATE TABLE IF NOT EXISTS document_checks (
    check_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id       UUID NOT NULL REFERENCES document_requirements(doc_id) ON DELETE CASCADE,
    has_document BOOLEAN NOT NULL,
    checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Feedback & QA — Table 18 (no foreign keys, no personal data by design)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feedback_logs (
    feedback_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sus_score            INTEGER NOT NULL CHECK (sus_score BETWEEN 0 AND 100),
    qualitative_feedback TEXT,
    submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Management & Security
-- ---------------------------------------------------------------------------
-- Table 12: Audit Logs (append-only; the API never updates or deletes rows)
CREATE TABLE IF NOT EXISTS audit_logs (
    audit_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES admin_users(user_id),
    action_type  VARCHAR(30) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    old_value    TEXT,
    new_value    TEXT,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs (timestamp DESC);

-- Tokens issued before this time are rejected (password reset / "revoke all sessions").
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS tokens_valid_after TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01';

-- Editable platform settings (security policy, SMS gateway, session TTL).
CREATE TABLE IF NOT EXISTS system_config (
    key        VARCHAR(100) PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_config (key, value) VALUES
('jwt_expire_minutes',    '60'),
('password_min_length',   '10'),
('max_failed_logins',     '5'),
('lockout_minutes',       '15'),
('rate_limit_per_minute', '60'),
('session_ttl_minutes',   '30'),
('purge_on_session_end',  'true'),
('allowed_origins',       '["http://localhost:3000"]'),
('sms_enabled',           'true'),
('sms_sender_name',       '"GINHAWAI"'),
('sms_api_key',           'null'),
('sms_api_key_updated_at','null')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Blind cross-validation (Scope: AI Model Validation Framework)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS validation_cases (
    case_id    VARCHAR(20) PRIMARY KEY,
    profile    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_ratings (
    case_id  VARCHAR(20) NOT NULL REFERENCES validation_cases(case_id) ON DELETE CASCADE,
    user_id  UUID NOT NULL REFERENCES admin_users(user_id),
    tier     VARCHAR(20) NOT NULL CHECK (tier IN ('high', 'moderate', 'low')),
    rated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (case_id, user_id)
);

-- Coordinates for the barangay that is already seeded.
UPDATE barangays SET latitude = 10.3310, longitude = 123.8790
WHERE barangay_code = '0730600034' AND latitude IS NULL;
