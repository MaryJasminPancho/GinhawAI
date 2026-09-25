-- DEVELOPMENT / DEMO ACCOUNTS ONLY — do not run this on a real deployment.
-- Creates one staff login per role so the admin console can be tested.
-- Password for every account: ginhawai123
--
-- Run AFTER schema*.sql and seed_accounts.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_dev_admins.sql
--
-- Safe to run more than once (existing roles/usernames are skipped).
-- Passwords are hashed with bcrypt via pgcrypto, which the backend's
-- bcrypt.checkpw() accepts, so no Python script is needed.

-- Executive roles from the manuscript's use case diagram (Fig. 10).
INSERT INTO roles (role_name, description) VALUES
('LGU Executive', 'Views anonymized analytics and policy intelligence reports'),
('Partner Organization', 'NGO/partner access to anonymized analytics and reports')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO admin_users (username, password_hash, role_id)
SELECT v.username, crypt('ginhawai123', gen_salt('bf', 12)), r.role_id
FROM (VALUES
    ('sysadmin',     'System Administrator'),
    ('lguadmin',     'LGU Administrator'),
    ('socialworker', 'Social Worker'),
    ('executive',    'LGU Executive'),
    ('partner',      'Partner Organization')
) AS v(username, role_name)
JOIN roles r ON r.role_name = v.role_name
ON CONFLICT (username) DO NOTHING;
