-- TUPAD details checked against DOLE Department Order No. 239, s. 2023 (copy given to the team
-- by DOLE, Nov 2026). Run after schema_admin.sql (which allows the 'senior' condition). Safe to re-run.
SET client_encoding = 'UTF8';

-- Sec. 11: only senior citizens submit a Certification of Fit to Work, so show it only when the
-- applicant is 60 or older.
UPDATE document_requirements d SET
    for_crisis = 'senior',
    notes = 'Only for applicants aged 60 or older. From the local health unit or a private health office. Seniors may join TUPAD if fit to work and not doing hazardous work. [DOLE DO 239-23 Sec. 8, 11]'
FROM programs p
WHERE d.program_id = p.program_id
  AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND d.document_name = 'Certification of Fit to Work';

-- Sec. 5c, 8: TUPAD is for the person who will do the work. The chat's work question is about the
-- household's main earner, so it can't decide TUPAD (a jobless member of a household whose main
-- earner has a regular job would be wrongly turned away). The applicant's own work is checked at
-- the office instead; the app shows it as "checked at the office" with a note.
UPDATE eligibility_criteria c SET
    attribute = 'is_disadvantaged_worker',
    operator = '=',
    threshold_value = 'true'
FROM programs p
WHERE c.program_id = p.program_id
  AND p.program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'
  AND c.attribute = 'employment_status';
