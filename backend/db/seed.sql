-- Starter programs (4Ps, AICS, TUPAD) with their rules and documents.
-- Safe to run more than once: programs that already exist are skipped, and rules or
-- documents are only added to a program that has none yet (so staff edits are kept).

INSERT INTO programs (program_name, agency, scope, is_active)
SELECT v.* FROM (VALUES
('Pantawid Pamilyang Pilipino Program (4Ps)', 'Department of Social Welfare and Development', 'National', TRUE),
('Assistance to Individuals in Crisis Situations (AICS)', 'Department of Social Welfare and Development', 'National', TRUE),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Department of Labor and Employment', 'National', TRUE)
) AS v(program_name, agency, scope, is_active)
WHERE NOT EXISTS (SELECT 1 FROM programs p WHERE lower(btrim(p.program_name)) = lower(btrim(v.program_name)));

INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight)
SELECT p.program_id, v.attribute, v.operator, v.threshold_value, v.weight
FROM programs p JOIN (VALUES
('Pantawid Pamilyang Pilipino Program (4Ps)', 'has_member_age_0_18_or_pregnant', '=', 'true', 0.35),
('Pantawid Pamilyang Pilipino Program (4Ps)', 'listed_in_targeting_system', '=', 'true', 0.35),
('Pantawid Pamilyang Pilipino Program (4Ps)', 'not_government_employee_or_elected_official', '=', 'true', 0.15),
('Pantawid Pamilyang Pilipino Program (4Ps)', 'not_receiving_other_dswd_program', '=', 'true', 0.15),
('Assistance to Individuals in Crisis Situations (AICS)', 'is_indigent_or_vulnerable', '=', 'true', 0.50),
('Assistance to Individuals in Crisis Situations (AICS)', 'has_supporting_documents_for_assistance_type', '=', 'true', 0.50),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'age', '>=', '18', 0.20),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'employment_status', '=', 'displaced_or_underemployed_or_seasonal', 0.30),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'physically_fit_for_assigned_task', '=', 'true', 0.20),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'belongs_to_priority_worker_group', '=', 'true', 0.30)
) AS v(program_name, attribute, operator, threshold_value, weight) ON p.program_name = v.program_name
WHERE NOT EXISTS (SELECT 1 FROM eligibility_criteria c WHERE c.program_id = p.program_id);

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes)
SELECT p.program_id, v.document_name, v.is_mandatory, v.notes
FROM programs p JOIN (VALUES
('Pantawid Pamilyang Pilipino Program (4Ps)', 'Valid Government-issued ID', TRUE, NULL::text),
('Pantawid Pamilyang Pilipino Program (4Ps)', 'Barangay Certificate of Residency/Indigency', TRUE, NULL::text),
('Pantawid Pamilyang Pilipino Program (4Ps)', 'Birth Certificate(s) of qualified children', TRUE, 'Required for household members aged 0-18'),
('Assistance to Individuals in Crisis Situations (AICS)', 'Valid Government-issued ID', TRUE, NULL::text),
('Assistance to Individuals in Crisis Situations (AICS)', 'Barangay Certificate of Indigency', TRUE, NULL::text),
('Assistance to Individuals in Crisis Situations (AICS)', 'Case-specific supporting document', TRUE, 'Varies by assistance type: medical certificate/hospital bill for medical assistance, death certificate/funeral contract for burial assistance'),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Valid Government-issued ID', TRUE, NULL::text),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Barangay Certification of Residency', TRUE, NULL::text),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Accomplished TUPAD Application Form', TRUE, NULL::text)
) AS v(program_name, document_name, is_mandatory, notes) ON p.program_name = v.program_name
WHERE NOT EXISTS (SELECT 1 FROM document_requirements d WHERE d.program_id = p.program_id);
