-- Read this file as UTF-8 even when psql runs in a Windows console (which defaults to WIN1252).
SET client_encoding = 'UTF8';

-- DEVELOPMENT / DEMO DATA ONLY.
-- Extra Cebu City barangays (with approximate map coordinates) and LGU offices
-- so the citizen office directory and the admin heatmap have something to show.
--
-- IMPORTANT: the barangay codes below are PLACEHOLDERS ("DEV-..."), not real
-- PSA PSGC codes. Replace them with the official codes (or add real barangays
-- from the admin console's Office Directory > Barangays tab) before using this
-- data in the study.
--
-- Run AFTER schema_admin.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_dev_localization.sql
-- Safe to run more than once.

INSERT INTO barangays (barangay_code, barangay_name, city_municipality, latitude, longitude) VALUES
('DEV-GUADALUPE',  'Guadalupe',         'Cebu City', 10.3196, 123.8906),
('DEV-LAHUG',      'Lahug',             'Cebu City', 10.3325, 123.8985),
('DEV-MABOLO',     'Mabolo',            'Cebu City', 10.3187, 123.9154),
('DEV-TALAMBAN',   'Talamban',          'Cebu City', 10.3665, 123.9128),
('DEV-BANILAD',    'Banilad',           'Cebu City', 10.3437, 123.9121),
('DEV-PARDO',      'Pardo',             'Cebu City', 10.2830, 123.8520),
('DEV-TISA',       'Tisa',              'Cebu City', 10.2983, 123.8700),
('DEV-LABANGON',   'Labangon',          'Cebu City', 10.3000, 123.8820),
('DEV-BASAKSN',    'Basak San Nicolas', 'Cebu City', 10.2880, 123.8680),
('DEV-PUNTA',      'Punta Princesa',    'Cebu City', 10.3040, 123.8740),
('DEV-ERMITA',     'Ermita',            'Cebu City', 10.2930, 123.8990),
('DEV-CAPITOL',    'Capitol Site',      'Cebu City', 10.3150, 123.8910),
('DEV-BUSAY',      'Busay',             'Cebu City', 10.3710, 123.8870),
('DEV-MAMBALING',  'Mambaling',         'Cebu City', 10.2870, 123.8800),
('DEV-INAYAWAN',   'Inayawan',          'Cebu City', 10.2700, 123.8540)
ON CONFLICT (barangay_code) DO NOTHING;

INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours)
SELECT v.* FROM (VALUES
  ('DSWD Field Office VII', 'M.J. Cuenco Ave. cor. Gen. Maxilom Ave., Cebu City', 'DEV-MABOLO', '(032) 232-9505', 'Mon–Fri, 8:00 AM – 5:00 PM'),
  ('Cebu City Dept. of Social Welfare and Services', 'Cebu City Hall, M.C. Briones St., Cebu City', 'DEV-ERMITA', '(032) 255-6984', 'Mon–Fri, 8:00 AM – 5:00 PM'),
  ('DOLE Cebu Provincial Field Office', 'Gen. Maxilom Ave. Ext., Cebu City', 'DEV-CAPITOL', '(032) 266-9722', 'Mon–Fri, 8:00 AM – 5:00 PM'),
  ('Barangay Kalunasan Hall', 'Kalunasan, Cebu City', '0730600034', NULL, 'Mon–Sat, 8:00 AM – 5:00 PM')
) AS v(office_name, address, barangay_code, contact_number, operating_hours)
WHERE NOT EXISTS (SELECT 1 FROM lgu_offices o WHERE o.office_name = v.office_name);
