-- Documents settled by the team's program verification (checked Oct 31 - Nov 5, 2026).
-- Rows still waiting on an office call are left out. Safe to re-run.
SET client_encoding = 'UTF8';

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, v.req, v.notes, v.crisis
FROM programs p JOIN (VALUES
    ('Assistance to Individuals in Crisis Situations (AICS)', 'Signed Authorization Letter', FALSE,
     'Only if someone else comes for the person getting help. An immediate family member doesn''t need one. [FO VII CC 2026 p. 150]', NULL),
    ('Assistance to Individuals in Crisis Situations (AICS)', 'Official Price Quotation', FALSE,
     'Only if you''re asking for help with medicine, a procedure or an assistive device. From the service provider, dated within the last 3 months. [FO VII CC 2026 p. 151-152]', 'medical'),
    ('Assistance to Individuals in Crisis Situations (AICS)', 'Certificate of Balance or Promissory Note', FALSE,
     'Only if the patient has already left the hospital. From the hospital''s billing or credit and collection office. [FO VII CC 2026 p. 151]', 'medical'),
    ('Assistance to Individuals in Crisis Situations (AICS)', 'Papers for other kinds of help', FALSE,
     'Only if you''re asking for transport, school, food or assistive device help, or you''re a stranded traveler or an overseas worker in distress. The papers depend on the help, so the office will tell you which ones. [FO VII CC 2026 p. 150-155]', NULL),
    ('Social Pension for Indigent Senior Citizens', 'Barangay Certificate of Indigency or Residency', TRUE,
     'From the barangay hall where the senior lives. [DSWD, via Cebu Daily News 2026]', NULL),
    ('Persons with Disability (PWD) ID', 'Philippine Registry Form for Persons with Disability', TRUE,
     'Ask the office for a copy when you apply. [NCDA CC 2025 p. 6]', NULL),
    ('Senior Citizen ID (OSCA)', 'Application Form', TRUE,
     'From the OSCA office. [Cebu City CC 2021 p. 831]', NULL),
    ('Senior Citizen ID (OSCA)', 'Sketch to your home', TRUE,
     'Drawn on the back of the application form. [Cebu City CC 2021 p. 831]', NULL),
    ('Senior Citizen ID (OSCA)', 'Photocopy of Voter''s Certification', TRUE,
     'From Comelec. [Cebu City CC 2021 p. 831]', NULL),
    ('Senior Citizen ID (OSCA)', 'Photocopy of Cedula', TRUE,
     'Issued in Cebu City, from the City Treasurer''s Office. [Cebu City CC 2021 p. 831]', NULL),
    ('Senior Citizen ID (OSCA)', 'Photocopy of Marriage Contract', FALSE,
     'Only if the senior citizen is married. [Cebu City CC 2021 p. 831]', NULL),
    ('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Certification of Fit to Work', FALSE,
     'Only for senior citizens. From the local health unit or a private health office. [TUPAD brochure]', NULL)
) AS v(program, name, req, notes, crisis) ON p.program_name = v.program
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

UPDATE document_requirements d SET
    notes = 'May be asked for. Dated within the last 3 months. From the barangay hall where you live now. [FO VII CC 2026 p. 154-155]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Barangay Certificate of Residency or Indigency';

-- The 2026 charter lists only the Solo Parent ID for this service.
DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Solo Parents'
  AND d.document_name IN ('Barangay Certificate of Residency', 'Documents for the type of help needed');

-- 4Ps: what DSWD asks for at registration, after it validates the household (DSWD FO VII, Nov 2021).
INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, FALSE, v.notes, NULL
FROM programs p JOIN (VALUES
    ('Marriage Certificate', 'Only if the parents are married. Asked when DSWD registers your household. [DSWD FO VII, 2021]'),
    ('School Enrollment Certificate', 'For each child in school. Asked when DSWD registers your household. [DSWD FO VII, 2021]'),
    ('Health Center Enrollment Certificate', 'Asked when DSWD registers your household. [DSWD FO VII, 2021]')
) AS v(name, notes) ON p.program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);

DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'
  AND d.document_name = 'Barangay Certificate of Residency/Indigency';

-- Solo Parents: the service only needs a registered solo parent. The income test applies
-- to the cash subsidy and discounts, not to this service (Solo Parents RIRR 2022).
DELETE FROM eligibility_criteria c USING programs p
WHERE c.program_id = p.program_id AND p.program_name = 'Assistance to Solo Parents'
  AND c.attribute = 'per_capita_income';

-- Social Pension: DSWD's list (Cebu Daily News, 2026). Birth certificate or an ID with the birth date, if available.
UPDATE document_requirements d SET
    document_name = 'Birth Certificate or Valid ID showing date of birth',
    is_mandatory  = FALSE,
    notes         = 'If available: a birth certificate or any valid ID that shows the date of birth. [DSWD, via Cebu Daily News 2026]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Social Pension for Indigent Senior Citizens'
  AND d.document_name = 'Birth Certificate';

DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Social Pension for Indigent Senior Citizens'
  AND d.document_name = 'Valid Government-issued ID';

-- TUPAD: DOLE DO 239-23 (19 June 2023). Beneficiaries bring one government ID (Sec. 11);
-- seniors also bring a fit-to-work certificate. Priority sectors are a funding rule (Sec. 26),
-- not a qualification, and there is no "similar assistance" exclusion.
DELETE FROM eligibility_criteria c USING programs p
WHERE c.program_id = p.program_id AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND c.attribute IN ('belongs_to_priority_worker_group', 'not_receiving_similar_assistance');

UPDATE eligibility_criteria c SET threshold_value = 'displaced_or_underemployed_or_seasonal_or_unemployed_or_informal'
FROM programs p
WHERE c.program_id = p.program_id AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND c.attribute = 'employment_status';

DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND d.document_name IN ('Barangay Certification of Residency', 'Bank or e-wallet account details',
                          'Proof of job loss or no regular work', 'Recent photo');

UPDATE document_requirements d SET notes = v.notes
FROM programs p, (VALUES
    ('Valid Government-issued ID', 'Any one: voter''s ID, postal ID, UMID, PhilHealth, Pag-IBIG, PhilSys, senior citizen''s ID, passport, LTO/LGU/SSS ID, barangay ID, or a police, NBI or barangay clearance. [DOLE DO 239-23]'),
    ('Accomplished TUPAD Application Form', 'The Profile of TUPAD Beneficiaries, filled out with DOLE or its partner (your LGU or barangay). [DOLE DO 239-23]'),
    ('Certification of Fit to Work', 'Only for senior citizens. From the local health unit or a private health office. [DOLE DO 239-23]')
) AS v(name, notes)
WHERE d.program_id = p.program_id AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND d.document_name = v.name;

-- PWD ID photo: sources differ on size (NCDA 1x1, Cebu City renewal 2x2), so ask for both.
UPDATE document_requirements d SET
    document_name = '1x1 and 2x2 ID Photos',
    notes = 'Have your 1x1 and 2x2 photos ready if asked.'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Persons with Disability (PWD) ID'
  AND d.document_name = '1x1 or 2x2 ID Photo';

-- Social Pension: no official peso limit (RA 11916 IRR; DSWD). Team decision (Nov 2026): drop
-- the ₱2,790 check and let the office assess income.
DELETE FROM eligibility_criteria c USING programs p
WHERE c.program_id = p.program_id AND p.program_name = 'Social Pension for Indigent Senior Citizens'
  AND c.attribute = 'per_capita_income';

-- AICS: the chat now asks what the citizen needs help paying for (help_needed), so each kind of
-- help shows only its own papers. Replaces the single "Papers for other kinds of help" row.
-- [DSWD FO VII Citizen's Charter 2026 p. 150-155]
UPDATE document_requirements d SET
    notes = 'For medicine or a procedure. From the pharmacy, hospital or supplier, dated within the last 3 months. [FO VII CC 2026 p. 151-152]'
FROM programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Official Price Quotation';

DELETE FROM document_requirements d USING programs p
WHERE d.program_id = p.program_id AND p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
  AND d.document_name = 'Papers for other kinds of help';

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes, for_crisis)
SELECT p.program_id, v.name, v.req, v.notes, v.help
FROM programs p JOIN (VALUES
    ('Prescription or request for the assistive device', TRUE,
     'From the attending doctor, dated within the last 3 months, with the doctor''s name, license number and signature. [FO VII CC 2026 p. 152]', 'assistive_device'),
    ('Official Price Quotation for the assistive device', TRUE,
     'From the supplier, dated within the last 3 months, with the issuing officer''s name and signature. [FO VII CC 2026 p. 152]', 'assistive_device'),
    ('Papers for transport help', TRUE,
     'One that fits the reason for the trip: police blotter, fit-to-travel medical certificate, jail release order, court order or subpoena, or death certificate. [FO VII CC 2026 p. 153]', 'transport'),
    ('School ID, Certificate of Enrollment or Statement of Account', TRUE,
     'Any one, signed by the school. Also bring the student''s valid ID, or the parent''s if the student is a minor. [FO VII CC 2026 p. 154]', 'education'),
    ('Social worker''s assessment (Social Case Study Report)', TRUE,
     'For food help. A social worker does this when you apply. [FO VII CC 2026 p. 154-155]', 'food'),
    ('Papers for your situation', TRUE,
     'For overseas workers in distress, rescued persons or stranded travelers. The office will tell you which ones. [FO VII CC 2026 p. 155]', 'other_help'),
    ('Certificate of Balance or Promissory Note from the funeral parlor', FALSE,
     'Only if there is an unpaid balance for the burial. Signed by the funeral parlor''s staff, dated within the last 3 months. [FO VII CC 2026 p. 151]', 'death')
) AS v(name, req, notes, help) ON p.program_name = 'Assistance to Individuals in Crisis Situations (AICS)'
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id AND d.document_name = v.name);
