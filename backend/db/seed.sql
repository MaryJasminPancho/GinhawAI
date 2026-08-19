INSERT INTO programs (program_name, agency, scope, is_active) VALUES
('Pantawid Pamilyang Pilipino Program (4Ps)', 'Department of Social Welfare and Development', 'National', TRUE),
('Assistance to Individuals in Crisis Situations (AICS)', 'Department of Social Welfare and Development', 'National', TRUE),
('Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)', 'Department of Labor and Employment', 'National', TRUE);

INSERT INTO eligibility_criteria (program_id, attribute, operator, threshold_value, weight) VALUES
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'has_member_age_0_18_or_pregnant', '=', 'true', 0.35),
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'listed_in_targeting_system', '=', 'true', 0.35),
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'not_government_employee_or_elected_official', '=', 'true', 0.15),
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'not_receiving_other_dswd_program', '=', 'true', 0.15),

((SELECT program_id FROM programs WHERE program_name = 'Assistance to Individuals in Crisis Situations (AICS)'), 'is_indigent_or_vulnerable', '=', 'true', 0.50),
((SELECT program_id FROM programs WHERE program_name = 'Assistance to Individuals in Crisis Situations (AICS)'), 'has_supporting_documents_for_assistance_type', '=', 'true', 0.50),

((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'age', '>=', '18', 0.20),
((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'employment_status', '=', 'displaced_or_underemployed_or_seasonal', 0.30),
((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'physically_fit_for_assigned_task', '=', 'true', 0.20),
((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'belongs_to_priority_worker_group', '=', 'true', 0.30);

INSERT INTO document_requirements (program_id, document_name, is_mandatory, notes) VALUES
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'Valid Government-issued ID', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'Barangay Certificate of Residency/Indigency', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Pantawid Pamilyang Pilipino Program (4Ps)'), 'Birth Certificate(s) of qualified children', TRUE, 'Required for household members aged 0-18'),

((SELECT program_id FROM programs WHERE program_name = 'Assistance to Individuals in Crisis Situations (AICS)'), 'Valid Government-issued ID', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Assistance to Individuals in Crisis Situations (AICS)'), 'Barangay Certificate of Indigency', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Assistance to Individuals in Crisis Situations (AICS)'), 'Case-specific supporting document', TRUE, 'Varies by assistance type: medical certificate/hospital bill for medical assistance, death certificate/funeral contract for burial assistance'),

((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'Valid Government-issued ID', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'Barangay Certification of Residency', TRUE, NULL),
((SELECT program_id FROM programs WHERE program_name = 'Tulong Panghanapbuhay sa Ating Disadvantaged/Displaced Workers (TUPAD)'), 'Accomplished TUPAD Application Form', TRUE, NULL);