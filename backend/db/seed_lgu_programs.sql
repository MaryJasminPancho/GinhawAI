-- Cebu City LGU programs: PWD ID and Senior Citizen (OSCA) ID.
-- Safe to re-run: every insert checks first.
--
-- Sources:
--   [RA10754] Republic Act 10754 (2016), expanding the benefits and privileges of persons with
--             disability; the PWD ID is issued by the city's Persons with Disability Affairs Office (PDAO).
--   [RA9994]  Republic Act 9994 (Expanded Senior Citizens Act of 2010); the senior citizen ID is
--             issued by the Office of Senior Citizens Affairs (OSCA) of the city.
-- VERIFY: document lists against what Cebu City PDAO and OSCA ask for at the counter today.
--
-- Run after seed_dswd_fo7_2023.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_lgu_programs.sql

INSERT INTO programs (program_name, agency, scope, is_active)
SELECT v.name, v.agency, 'Municipal', TRUE
FROM (VALUES
    ('Persons with Disability (PWD) ID',  'Cebu City Persons with Disability Affairs Office (PDAO)'),
    ('Senior Citizen ID (OSCA)',          'Cebu City Office of Senior Citizens Affairs (OSCA)')
) AS v(name, agency)
WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE lower(btrim(p.program_name)) = lower(btrim(v.name)));

INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight)
SELECT p.program_id, v.attribute, v.op, v.threshold, v.weight
FROM programs p JOIN (VALUES
    -- [RA10754] Any resident with a long-term physical, mental, intellectual or sensory impairment.
    ('Persons with Disability (PWD) ID', 'has_pwd',           '=', 'true', 1.00),
    -- [RA9994] Any resident Filipino aged 60 or older.
    ('Senior Citizen ID (OSCA)',         'has_senior_member', '=', 'true', 1.00)
) AS v(program, attribute, op, threshold, weight) ON p.program_name = v.program
WHERE NOT EXISTS (SELECT 1 FROM eligibility_criteria c WHERE c.program_id = p.program_id AND c.attribute = v.attribute);

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, v.req, v.notes, NULL
FROM programs p JOIN (VALUES
    ('Persons with Disability (PWD) ID', 'Certificate of Disability or Medical Certificate', TRUE,
     'Signed by a licensed doctor, stating the type of disability. Not needed if the disability is visible (apparent). [RA10754] VERIFY with PDAO.'),
    ('Persons with Disability (PWD) ID', 'Barangay Certificate of Residency', TRUE,
     'From your barangay hall, showing you live in Cebu City. VERIFY with PDAO.'),
    ('Persons with Disability (PWD) ID', '1x1 or 2x2 ID Photo', TRUE,
     'Recent photo of the person with disability. VERIFY size with PDAO.'),
    ('Persons with Disability (PWD) ID', 'Birth Certificate or Valid ID', FALSE,
     'Proof of identity of the person with disability. VERIFY with PDAO.'),
    ('Senior Citizen ID (OSCA)', 'Birth Certificate or Valid ID showing date of birth', TRUE,
     'Proof that the senior is 60 or older (PSA birth certificate, passport, voter''s ID, etc.). [RA9994] VERIFY with OSCA.'),
    ('Senior Citizen ID (OSCA)', 'Barangay Certificate of Residency', TRUE,
     'From your barangay hall, showing the senior lives in Cebu City. VERIFY with OSCA.'),
    ('Senior Citizen ID (OSCA)', '1x1 or 2x2 ID Photo', TRUE,
     'Recent photo of the senior citizen. VERIFY size with OSCA.')
) AS v(program, name, req, notes) ON p.program_name = v.program
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

-- Social Pension: the pensioner is the senior, who may not be the person chatting (a son or
-- daughter often asks for a parent). Match on "a senior in the household" instead of the
-- applicant's own age. has_senior_member is true when the applicant is 60+ too.
UPDATE eligibility_criteria c
SET attribute = 'has_senior_member', operator = '=', threshold_value = 'true'
FROM programs p
WHERE c.program_id = p.program_id
  AND p.program_name = 'Social Pension for Indigent Senior Citizens'
  AND c.attribute = 'age';
