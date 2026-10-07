-- Read this file as UTF-8 even when psql runs in a Windows console (which defaults to WIN1252).
SET client_encoding = 'UTF8';

-- DEVELOPMENT / DEMO DATA ONLY.
-- Sample LGU offices so the citizen office directory has something to show.
-- (The real DSWD offices come from seed_dswd_fo7_2023.sql.)
-- (The barangays themselves, all 80 with official PSGC codes, now come from
-- seed_cebu_city_barangays.sql; the old "DEV-..." placeholder barangays are gone.)
--
-- Run AFTER schema_admin.sql and seed_cebu_city_barangays.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_dev_localization.sql
-- Safe to run more than once.

INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours)
SELECT v.* FROM (VALUES
  ('Cebu City Dept. of Social Welfare and Services', 'Cebu City Hall, M.C. Briones St., Cebu City', '0730600028', '(032) 255-6984', 'Mon–Fri, 8:00 AM – 5:00 PM'),
  ('DOLE Cebu Provincial Field Office', 'Gen. Maxilom Ave. Ext., Cebu City', '0730600020', '(032) 266-9722', 'Mon–Fri, 8:00 AM – 5:00 PM'),
  ('Barangay Kalunasan Hall', 'Kalunasan, Cebu City', '0730600034', NULL, 'Mon–Sat, 8:00 AM – 5:00 PM')
) AS v(office_name, address, barangay_code, contact_number, operating_hours)
WHERE NOT EXISTS (SELECT 1 FROM lgu_offices o WHERE o.office_name = v.office_name);
