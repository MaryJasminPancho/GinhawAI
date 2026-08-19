CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE programs (
    program_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_name VARCHAR(255) NOT NULL,
    agency       VARCHAR(255) NOT NULL,
    scope        VARCHAR(100),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE eligibility_criteria (
    criteria_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    attribute       VARCHAR(100) NOT NULL,
    operator        VARCHAR(20) NOT NULL,
    threshold_value VARCHAR(100) NOT NULL,
    weight          DECIMAL(5,2) NOT NULL
);

CREATE TABLE document_requirements (
    doc_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id    UUID NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    document_name VARCHAR(255) NOT NULL,
    is_mandatory  BOOLEAN NOT NULL DEFAULT TRUE,
    notes         TEXT
);