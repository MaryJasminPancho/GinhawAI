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
('password_min_length',   '8'),
('max_failed_logins',     '5'),
('lockout_minutes',       '15'),
('rate_limit_per_minute', '60'),
('session_ttl_minutes',   '30'),
('purge_on_session_end',  'true'),
('allowed_origins',       '["http://localhost:3000"]'),
('sms_enabled',           'true'),
('sms_sender_name',       '""'),
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

-- ---------------------------------------------------------------------------
-- Password changes with System Administrator approval
-- ---------------------------------------------------------------------------
-- TRUE for accounts holding a temporary password (new accounts, admin resets):
-- they must request a new password before they can use the console.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- A requested new password waits here (bcrypt hash only) until a System
-- Administrator approves or rejects it. The old password keeps working meanwhile.
CREATE TABLE IF NOT EXISTS password_change_requests (
    request_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES admin_users(user_id),
    new_password_hash VARCHAR(255) NOT NULL,
    reason            VARCHAR(20) NOT NULL CHECK (reason IN ('first_login', 'voluntary')),
    status            VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by        UUID REFERENCES admin_users(user_id),
    decided_at        TIMESTAMPTZ,
    decision_note     TEXT
);
-- At most one pending request per account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_password_request_pending ON password_change_requests (user_id) WHERE status = 'pending';

-- Password rules: at least 8 characters, starting with a capital letter, with at
-- least one special character. Databases still on the old default (10) move to 8;
-- a value an administrator set on purpose is left alone.
UPDATE system_config SET value = '8', updated_at = NOW()
WHERE key = 'password_min_length' AND value = '10'::jsonb;

-- System Administrators may view a requested password before approving it.
-- It is kept encrypted (key derived from the backend SECRET_KEY) only while the
-- request is pending, and erased once it is approved, rejected or cancelled.
ALTER TABLE password_change_requests ADD COLUMN IF NOT EXISTS new_password_encrypted TEXT;

-- Each System Administrator's 4-digit PIN for viewing requested passwords
-- (bcrypt hash only), with a lockout after repeated wrong PINs.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reveal_pin_hash VARCHAR(255);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reveal_pin_failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS reveal_pin_locked_until TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Staff profiles: display name and profile picture (Manage Profile Dashboard)
-- ---------------------------------------------------------------------------
-- full_name is shown instead of the username; the username stays the sign-in name.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
-- Profile picture, already cropped and resized (256x256) by the browser.
-- Stored in the database so the server keeps no files on disk.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS avatar BYTEA;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS avatar_mime VARCHAR(20);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Forgot password by SMS code
-- ---------------------------------------------------------------------------
-- Staff add their own mobile number on My Account and confirm it with a code.
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(11);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mobile_verified_at TIMESTAMPTZ;

-- One-time 6-digit codes sent by SMS (only a keyed hash is stored).
CREATE TABLE IF NOT EXISTS sms_codes (
    code_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES admin_users(user_id),
    purpose       VARCHAR(20) NOT NULL CHECK (purpose IN ('verify_mobile', 'forgot_password')),
    code_hash     VARCHAR(64) NOT NULL,
    target_number VARCHAR(11) NOT NULL,
    attempts      INTEGER NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sms_codes_user ON sms_codes (user_id, purpose, created_at DESC);

-- A password set through "forgot password" is a third kind of request.
ALTER TABLE password_change_requests DROP CONSTRAINT IF EXISTS password_change_requests_reason_check;
ALTER TABLE password_change_requests ADD CONSTRAINT password_change_requests_reason_check
    CHECK (reason IN ('first_login', 'voluntary', 'forgot_password'));

-- ---------------------------------------------------------------------------
-- Email (free alternative to SMS): staff verify an email address for
-- forgot-password codes; citizens can optionally have their checklist emailed.
-- ---------------------------------------------------------------------------
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- sms_codes now holds email codes too: the target can be an email address.
ALTER TABLE sms_codes ALTER COLUMN target_number TYPE VARCHAR(254);
ALTER TABLE sms_codes DROP CONSTRAINT IF EXISTS sms_codes_purpose_check;
ALTER TABLE sms_codes ADD CONSTRAINT sms_codes_purpose_check
    CHECK (purpose IN ('verify_mobile', 'verify_email', 'forgot_password'));

-- Checklist emails sent to citizens (address masked, like sms_logs).
CREATE TABLE IF NOT EXISTS email_logs (
    email_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    masked_recipient VARCHAR(80) NOT NULL,
    program_id       UUID NOT NULL REFERENCES programs(program_id),
    delivery_status  VARCHAR(20) NOT NULL,
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_logs_time ON email_logs (sent_at);

INSERT INTO system_config (key, value) VALUES
('email_enabled',   'true'),
('smtp_host',       '"smtp.gmail.com"'),
('smtp_port',       '465'),
('smtp_username',   'null'),
('smtp_password',   'null'),
('email_from_name', '"GinhawAI"')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- A document can apply to one crisis type only (e.g. AICS: death certificate
-- only for a death in the family). NULL = always shown.
-- ---------------------------------------------------------------------------
ALTER TABLE document_requirements ADD COLUMN IF NOT EXISTS for_crisis VARCHAR(20);
ALTER TABLE document_requirements DROP CONSTRAINT IF EXISTS document_requirements_for_crisis_check;
ALTER TABLE document_requirements ADD CONSTRAINT document_requirements_for_crisis_check
    CHECK (for_crisis IS NULL OR for_crisis IN ('medical', 'death', 'fire', 'calamity', 'job_loss'));

-- ---------------------------------------------------------------------------
-- Local words and slang the chat understands (admin console > Local Terms).
-- The starting list (the words that used to be in the code) is copied in once;
-- after that staff own it, so words they remove don't come back.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jargon_terms (
    term_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot       VARCHAR(30) NOT NULL CHECK (slot IN ('employment_status', 'housing_type', 'crisis_type')),
    value      VARCHAR(30) NOT NULL,
    term       VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jargon_term ON jargon_terms (slot, lower(term));

INSERT INTO jargon_terms (slot, value, term)
SELECT v.slot, v.value, v.term FROM (VALUES
('employment_status', 'unemployed', 'walang trabaho'),
('employment_status', 'unemployed', 'walay trabaho'),
('employment_status', 'unemployed', 'no work'),
('employment_status', 'unemployed', 'jobless'),
('employment_status', 'unemployed', 'wala trabaho'),
('employment_status', 'unemployed', 'unemployed'),
('employment_status', 'displaced', 'natanggal'),
('employment_status', 'displaced', 'tinanggal'),
('employment_status', 'displaced', 'natangtang'),
('employment_status', 'displaced', 'laid off'),
('employment_status', 'displaced', 'lost my job'),
('employment_status', 'displaced', 'lost job'),
('employment_status', 'displaced', 'displaced'),
('employment_status', 'informal', 'arawan'),
('employment_status', 'informal', 'daily'),
('employment_status', 'informal', 'extra'),
('employment_status', 'informal', 'sideline'),
('employment_status', 'informal', 'odd job'),
('employment_status', 'informal', 'construction'),
('employment_status', 'informal', 'tricycle'),
('employment_status', 'informal', 'habal'),
('employment_status', 'informal', 'labandera'),
('employment_status', 'seasonal', 'seasonal'),
('employment_status', 'seasonal', 'pana-panahon'),
('employment_status', 'seasonal', 'harvest'),
('employment_status', 'underemployed', 'kulang'),
('employment_status', 'underemployed', 'part-time'),
('employment_status', 'underemployed', 'part time'),
('employment_status', 'underemployed', 'underemployed'),
('employment_status', 'self_employed', 'negosyo'),
('employment_status', 'self_employed', 'tindahan'),
('employment_status', 'self_employed', 'sari-sari'),
('employment_status', 'self_employed', 'business'),
('employment_status', 'self_employed', 'vendor'),
('employment_status', 'self_employed', 'tinda'),
('employment_status', 'employed', 'regular'),
('employment_status', 'employed', 'empleyado'),
('employment_status', 'employed', 'employed'),
('employment_status', 'employed', 'office'),
('employment_status', 'employed', 'trabaho sa'),
('employment_status', 'employed', 'may trabaho'),
('employment_status', 'employed', 'naay trabaho'),
('housing_type', 'informal_settler', 'informal'),
('housing_type', 'informal_settler', 'squatter'),
('housing_type', 'informal_settler', 'iskwater'),
('housing_type', 'informal_settler', 'walang titulo'),
('housing_type', 'rented', 'upa'),
('housing_type', 'rented', 'abang'),
('housing_type', 'rented', 'rent'),
('housing_type', 'rented', 'boarding'),
('housing_type', 'rented', 'bedspace'),
('housing_type', 'with_relatives', 'kamag-anak'),
('housing_type', 'with_relatives', 'paryente'),
('housing_type', 'with_relatives', 'relatives'),
('housing_type', 'with_relatives', 'kapatid'),
('housing_type', 'with_relatives', 'parents'),
('housing_type', 'with_relatives', 'magulang'),
('housing_type', 'with_relatives', 'ginikanan'),
('housing_type', 'with_relatives', 'nakikitira'),
('housing_type', 'with_relatives', 'nakipuyo'),
('housing_type', 'owned', 'sariling'),
('housing_type', 'owned', 'kaugalingon'),
('housing_type', 'owned', 'own'),
('housing_type', 'owned', 'amin'),
('housing_type', 'owned', 'amoa'),
('crisis_type', 'none', 'wala'),
('crisis_type', 'none', 'none'),
('crisis_type', 'none', 'no'),
('crisis_type', 'none', 'dili'),
('crisis_type', 'none', 'hindi'),
('crisis_type', 'none', 'okay'),
('crisis_type', 'none', 'ok'),
('crisis_type', 'medical', 'ospital'),
('crisis_type', 'medical', 'hospital'),
('crisis_type', 'medical', 'sakit'),
('crisis_type', 'medical', 'medical'),
('crisis_type', 'medical', 'gamot'),
('crisis_type', 'medical', 'tambal'),
('crisis_type', 'medical', 'operasyon'),
('crisis_type', 'medical', 'dialysis'),
('crisis_type', 'death', 'namatay'),
('crisis_type', 'death', 'patay'),
('crisis_type', 'death', 'death'),
('crisis_type', 'death', 'died'),
('crisis_type', 'death', 'lamay'),
('crisis_type', 'death', 'burial'),
('crisis_type', 'death', 'funeral'),
('crisis_type', 'fire', 'sunog'),
('crisis_type', 'fire', 'sunugan'),
('crisis_type', 'fire', 'nasunog'),
('crisis_type', 'fire', 'fire'),
('crisis_type', 'calamity', 'baha'),
('crisis_type', 'calamity', 'bagyo'),
('crisis_type', 'calamity', 'flood'),
('crisis_type', 'calamity', 'typhoon'),
('crisis_type', 'calamity', 'lindol'),
('crisis_type', 'calamity', 'earthquake'),
('crisis_type', 'calamity', 'calamity'),
('crisis_type', 'job_loss', 'nawalan ng kita'),
('crisis_type', 'job_loss', 'nawad-an'),
('crisis_type', 'job_loss', 'lost income'),
('crisis_type', 'job_loss', 'job loss')
) AS v(slot, value, term)
WHERE NOT EXISTS (SELECT 1 FROM system_config WHERE key = 'jargon_seeded')
ON CONFLICT DO NOTHING;
INSERT INTO system_config (key, value) VALUES ('jargon_seeded', 'true') ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Feedback resolution tracking (Appendix R #70). Feedback stays anonymous:
-- only the staff side (status, note, who updated it) is added.
-- ---------------------------------------------------------------------------
ALTER TABLE feedback_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'new';
ALTER TABLE feedback_logs DROP CONSTRAINT IF EXISTS feedback_logs_status_check;
ALTER TABLE feedback_logs ADD CONSTRAINT feedback_logs_status_check CHECK (status IN ('new', 'seen', 'acted_on'));
ALTER TABLE feedback_logs ADD COLUMN IF NOT EXISTS staff_note TEXT;
ALTER TABLE feedback_logs ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ;
ALTER TABLE feedback_logs ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES admin_users(user_id);

-- ---------------------------------------------------------------------------
-- Partner registry: NGOs and civil society groups and the help they offer
-- (Appendix R #38 "Track Neighborhood NGO Resource Tracks" and #40 "Maintain
-- Local Civil Society Registries"). Entries added or changed by a Partner
-- Organization account stay hidden from citizens until LGU staff verify them.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_organizations (
    org_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(200) NOT NULL,
    org_type      VARCHAR(30) NOT NULL CHECK (org_type IN ('ngo', 'faith_based', 'civic', 'cooperative', 'private', 'academe', 'government')),
    services      TEXT,
    address       TEXT,
    barangay_code VARCHAR(20) REFERENCES barangays(barangay_code) ON DELETE SET NULL,
    contact       VARCHAR(100),
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    managed_by    UUID REFERENCES admin_users(user_id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_resources (
    resource_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES partner_organizations(org_id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    details       TEXT,
    barangay_code VARCHAR(20) REFERENCES barangays(barangay_code) ON DELETE SET NULL,
    starts_on     DATE,
    ends_on       DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_partner_resources_org ON partner_resources (org_id);
