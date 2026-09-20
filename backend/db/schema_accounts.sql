CREATE TABLE roles (
    role_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name   VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE admin_users (
    user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id       UUID NOT NULL REFERENCES roles(role_id),
    office_id     UUID, -- TODO: add REFERENCES lgu_offices(office_id) once Localization Module exists
    last_login    TIMESTAMP,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);