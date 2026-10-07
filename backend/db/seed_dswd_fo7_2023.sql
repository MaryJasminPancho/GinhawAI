-- Read this file as UTF-8 even when psql runs in a Windows console (which defaults to WIN1252).
SET client_encoding = 'UTF8';

-- Program rules, document requirements and Cebu City offices taken from:
--   [CC]  DSWD Field Office VII Citizen's Charter Handbook (2023, v1)
--         AICS p. 307-313, Solo Parent p. 344-345, Social Pension p. 371-372,
--         List of Offices p. 697-706
--   [TUP] Respicio & Co., "DOLE TUPAD Program Application Requirements"
-- The handbook is from March 2023: replace any figure or phone number here as
-- soon as an updated version is available (or edit it in the admin console).
--
-- Run AFTER seed.sql, schema_admin.sql and seed_cebu_city_barangays.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_dswd_fo7_2023.sql
-- Safe to run more than once: it only adds what's missing and updates the
-- entries it owns (matched by name).

BEGIN;

-- ===========================================================================
-- 1. AICS: documents per type of crisis instead of one vague "supporting document"
-- ===========================================================================
UPDATE document_requirements d SET
    notes = 'Original and 2 photocopies. Accepted: PhilSys National ID, SSS/GSIS/UMID, PhilHealth, driver''s license, PRC, OWWA, Pag-IBIG, voter''s ID or certification, PNP, Senior Citizen ID, postal ID, passport, NBI clearance or Barangay ID. [CC p. 307]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Valid Government-issued ID';

UPDATE document_requirements d SET
    document_name = 'Barangay Certificate of Residency or Indigency',
    is_mandatory  = FALSE,
    notes         = 'May be asked for. From the barangay hall where you live now. [CC p. 308]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Barangay Certificate of Indigency';

DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Case-specific supporting document';

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, v.req, v.notes, v.crisis
FROM programs p, (VALUES
    ('Medical Certificate or Clinical Abstract', TRUE,
     'Issued within the last 3 months, with the doctor''s name, license number and signature. From the attending doctor or the hospital''s Medical Records. [CC p. 308]', 'medical'),
    ('Hospital bill, prescription or laboratory request', TRUE,
     'Whichever applies: hospital bill / statement of account, a dated prescription (within 3 months), or the doctor''s laboratory request. [CC p. 308-310]', 'medical'),
    ('Social Case Study Report or Case Summary', TRUE,
     'From a licensed social worker: DSWD, the City Social Welfare office, or the hospital''s Medical Social Service. [CC p. 309]', 'medical'),
    ('Registered Death Certificate', TRUE,
     'Original or certified true copy. From the City Civil Registry (City Hall), the hospital or the funeral parlor. [CC p. 310]', 'death'),
    ('Funeral Contract', TRUE,
     'From the funeral parlor or memorial chapel. [CC p. 310]', 'death'),
    ('Transfer Permit', FALSE,
     'Only if the body is being moved to another place. From City Hall, the hospital or the funeral parlor. [CC p. 311]', 'death'),
    ('Police or Bureau of Fire Protection (BFP) Report', TRUE,
     'Report of the fire. From the police station or the Bureau of Fire Protection. [CC p. 312]', 'fire'),
    ('Barangay certification of the incident', FALSE,
     'Or another official report about the flood, typhoon or calamity, if available. [CC p. 313]', 'calamity')
) AS v(name, req, notes, crisis)
WHERE p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

-- ===========================================================================
-- 2. New programs: Social Pension and Assistance to Solo Parents
-- ===========================================================================
INSERT INTO programs (program_name, agency, scope, is_active)
SELECT v.name, 'Department of Social Welfare and Development', 'National', TRUE
FROM (VALUES ('Social Pension for Indigent Senior Citizens'), ('Assistance to Solo Parents')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE p.program_name = v.name);

INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight)
SELECT p.program_id, v.attribute, v.op, v.threshold, v.weight
FROM programs p JOIN (VALUES
    -- [CC p. 371] "Indigent senior citizens"; cross-matched with SSS, GSIS, PVAO, AFPSLAI.
    ('Social Pension for Indigent Senior Citizens', 'age',                         '>=', '60',   0.40),
    ('Social Pension for Indigent Senior Citizens', 'per_capita_income',           '<=', '2790', 0.30),
    ('Social Pension for Indigent Senior Citizens', 'not_receiving_other_pension', '=',  'true', 0.30),
    -- [CC p. 344] Solo parents with income at or below the poverty threshold.
    ('Assistance to Solo Parents', 'is_solo_parent',    '=',  'true', 0.50),
    ('Assistance to Solo Parents', 'per_capita_income', '<=', '2790', 0.50)
) AS v(program, attribute, op, threshold, weight) ON p.program_name = v.program
WHERE NOT EXISTS (SELECT 1 FROM eligibility_criteria c WHERE c.program_id = p.program_id AND c.attribute = v.attribute);

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, v.req, v.notes, NULL
FROM programs p JOIN (VALUES
    ('Social Pension for Indigent Senior Citizens', 'OSCA ID', TRUE,
     'Senior citizen ID from the Office of Senior Citizens Affairs (OSCA). [CC p. 371]'),
    ('Social Pension for Indigent Senior Citizens', 'Birth Certificate', FALSE,
     'Only if you don''t have an OSCA ID yet. From PSA. [CC p. 371]'),
    ('Social Pension for Indigent Senior Citizens', 'Social Pension Application Form', TRUE,
     'Filled up at OSCA or the City Social Welfare office, which endorses you to DSWD. [CC p. 371-372]'),
    ('Assistance to Solo Parents', 'Solo Parent ID', TRUE,
     'From the City Social Welfare office. [CC p. 345]'),
    ('Assistance to Solo Parents', 'Barangay Certificate of Residency', TRUE,
     'From the barangay hall where you live now. [CC p. 345]'),
    ('Assistance to Solo Parents', 'Documents for the type of help needed', FALSE,
     'For medical, burial or transportation help, the same papers as AICS (e.g. medical certificate, death certificate, police blotter). [CC p. 345]')
) AS v(program, name, req, notes) ON p.program_name = v.program
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

-- ===========================================================================
-- 3. TUPAD: disqualifications and the documents usually asked for
-- ===========================================================================
INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight)
SELECT p.program_id, v.attribute, '=', 'true', 0.10
FROM programs p, (VALUES ('not_government_employee_or_elected_official'), ('not_receiving_similar_assistance')) AS v(attribute)
WHERE p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND NOT EXISTS (SELECT 1 FROM eligibility_criteria c WHERE c.program_id = p.program_id AND c.attribute = v.attribute);

UPDATE document_requirements d SET notes = 'Also called the beneficiary profile form. From DOLE or your barangay. [TUP]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND d.document_name = 'Accomplished TUPAD Application Form' AND d.notes IS NULL;

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, FALSE, v.notes, NULL
FROM programs p, (VALUES
    ('Recent photo', 'Usually asked for when you register. [TUP]'),
    ('Proof of job loss or no regular work', 'If you lost your job: e.g. a termination notice or a barangay certification. [TUP]'),
    ('Bank or e-wallet account details', 'Where your wage will be sent. TUPAD is "no work, no pay" at the regional minimum wage. [TUP]')
) AS v(name, notes)
WHERE p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

-- ===========================================================================
-- 4. Real DSWD offices in Cebu City [CC p. 697-703]
--    (Shelters for women and children are left out on purpose: their
--     locations shouldn't be shown to the public.)
-- ===========================================================================
CREATE TEMP TABLE dswd_offices (office_name TEXT, address TEXT, barangay_code TEXT, contact_number TEXT, operating_hours TEXT) ON COMMIT DROP;
INSERT INTO dswd_offices VALUES
    ('DSWD Field Office VII', 'M.J. Cuenco Ave. cor. Gen. Maxilom Ave., Carreta, Cebu City',
     '0730600021', '(032) 233-8785 · 4Ps hotline 0918 912 2813', 'Mon–Fri, 8:00 AM – 5:00 PM'),
    ('DSWD Crisis Intervention Section (AICS)', 'Gorordo Ave. cor. M.J. Cuenco Ave., Carreta, Cebu City',
     '0730600021', '(032) 233-8785 loc. 132 / 145', 'Mon–Fri, 8:00 AM – 5:00 PM'),
    ('DSWD Area Vocational Rehabilitation Center II (PWD)', 'Camomot-Franza Rd., Labangon, Cebu City',
     '0730600040', '(032) 261-0001 / 261-4021', 'Mon–Fri, 8:00 AM – 5:00 PM');

UPDATE lgu_offices o SET address = s.address, barangay_code = s.barangay_code,
                         contact_number = s.contact_number, operating_hours = s.operating_hours
FROM dswd_offices s WHERE o.office_name = s.office_name;

INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours)
SELECT s.* FROM dswd_offices s
WHERE NOT EXISTS (SELECT 1 FROM lgu_offices o WHERE o.office_name = s.office_name);

COMMIT;
