-- Read this file as UTF-8 even when psql runs in a Windows console (which defaults to WIN1252).
SET client_encoding = 'UTF8';

-- All 80 barangays of Cebu City with their official PSA PSGC codes.
--   Codes: Philippine Standard Geographic Code (PSA), Cebu City = 07306.
--   Coordinates: approximate barangay centre points from OpenStreetMap
--   (© OpenStreetMap contributors, ODbL). They place each barangay on the
--   heatmap; staff can correct any of them in Office Directory > Barangays.
--
-- Run AFTER schema_admin.sql (it adds the latitude/longitude columns):
--   psql -U postgres -d ginhawai -f backend/db/seed_cebu_city_barangays.sql
--
-- Safe to run more than once. Coordinates that staff already set are kept.
-- Placeholder barangays with the same name (the "DEV-..." demo rows, or ones
-- added by hand with a made-up code) are merged into the official ones: their
-- offices and assessment records are moved over, then the duplicate is removed.

BEGIN;

INSERT INTO barangays (barangay_code, barangay_name, city_municipality, latitude, longitude) VALUES
('0730600001', 'Adlaon',              'Cebu City', 10.4369, 123.8680),
('0730600002', 'Agsungot',            'Cebu City', 10.4349, 123.9102),
('0730600003', 'Apas',                'Cebu City', 10.3375, 123.9056),
('0730600004', 'Babag',               'Cebu City', 10.3740, 123.8503),
('0730600005', 'Basak Pardo',         'Cebu City', 10.2865, 123.8646),
('0730600006', 'Bacayan',             'Cebu City', 10.3855, 123.9199),
('0730600007', 'Banilad',             'Cebu City', 10.3465, 123.9111),
('0730600008', 'Basak San Nicolas',   'Cebu City', 10.2865, 123.8703),
('0730600010', 'Binaliw',             'Cebu City', 10.4228, 123.9161),
('0730600011', 'Bonbon',              'Cebu City', 10.3666, 123.8277),
('0730600013', 'Budla-an',            'Cebu City', 10.3793, 123.8859),
('0730600014', 'Buhisan',             'Cebu City', 10.3088, 123.8535),
('0730600015', 'Bulacao',             'Cebu City', 10.2755, 123.8514),
('0730600016', 'Buot-Taup Pardo',     'Cebu City', 10.3480, 123.8081),
('0730600017', 'Busay',               'Cebu City', 10.3608, 123.8847),
('0730600018', 'Calamba',             'Cebu City', 10.3016, 123.8845),
('0730600019', 'Cambinocot',          'Cebu City', 10.4631, 123.8975),
('0730600020', 'Capitol Site',        'Cebu City', 10.3247, 123.8902),
('0730600021', 'Carreta',             'Cebu City', 10.3082, 123.9149),
('0730600022', 'Central',             'Cebu City', 10.2951, 123.9028),
('0730600023', 'Cogon Ramos',         'Cebu City', 10.3049, 123.8984),
('0730600024', 'Cogon Pardo',         'Cebu City', 10.2774, 123.8621),
('0730600025', 'Day-as',              'Cebu City', 10.3015, 123.9023),
('0730600027', 'Duljo',               'Cebu City', 10.2917, 123.8849),
('0730600028', 'Ermita',              'Cebu City', 10.2917, 123.8974),
('0730600029', 'Guadalupe',           'Cebu City', 10.3229, 123.8839),
('0730600030', 'Guba',                'Cebu City', 10.4282, 123.8899),
('0730600031', 'Hippodromo',          'Cebu City', 10.3141, 123.9070),
('0730600032', 'Inayawan',            'Cebu City', 10.2702, 123.8564),
('0730600033', 'Kalubihan',           'Cebu City', 10.2977, 123.8991),
('0730600034', 'Kalunasan',           'Cebu City', 10.3389, 123.8796),
('0730600035', 'Kamagayan',           'Cebu City', 10.2998, 123.8995),
('0730600036', 'Camputhaw',           'Cebu City', 10.3182, 123.8972),
('0730600037', 'Kasambagan',          'Cebu City', 10.3251, 123.9113),
('0730600038', 'Kinasang-an Pardo',   'Cebu City', 10.2823, 123.8591),
('0730600040', 'Labangon',            'Cebu City', 10.2994, 123.8791),
('0730600041', 'Lahug',               'Cebu City', 10.3309, 123.8981),
('0730600042', 'Lorega',              'Cebu City', 10.3066, 123.9042),
('0730600043', 'Lusaran',             'Cebu City', 10.4910, 123.8906),
('0730600044', 'Luz',                 'Cebu City', 10.3211, 123.9078),
('0730600045', 'Mabini',              'Cebu City', 10.4527, 123.9190),
('0730600046', 'Mabolo',              'Cebu City', 10.3143, 123.9147),
('0730600048', 'Malubog',             'Cebu City', 10.3804, 123.8693),
('0730600049', 'Mambaling',           'Cebu City', 10.2911, 123.8773),
('0730600050', 'Pahina Central',      'Cebu City', 10.2966, 123.8924),
('0730600051', 'Pahina San Nicolas',  'Cebu City', 10.2940, 123.8928),
('0730600052', 'Pamutan',             'Cebu City', 10.3334, 123.8355),
('0730600053', 'Pardo',               'Cebu City', 10.2794, 123.8554),
('0730600054', 'Pari-an',             'Cebu City', 10.2989, 123.9027),
('0730600055', 'Paril',               'Cebu City', 10.4750, 123.9159),
('0730600056', 'Pasil',               'Cebu City', 10.2902, 123.8947),
('0730600057', 'Pit-os',              'Cebu City', 10.3964, 123.9217),
('0730600059', 'Pulangbato',          'Cebu City', 10.3979, 123.9063),
('0730600060', 'Pung-ol-Sibugay',     'Cebu City', 10.3970, 123.8495),
('0730600062', 'Punta Princesa',      'Cebu City', 10.2949, 123.8702),
('0730600063', 'Quiot Pardo',         'Cebu City', 10.2890, 123.8586),
('0730600064', 'Sambag I',            'Cebu City', 10.3008, 123.8920),
('0730600065', 'Sambag II',           'Cebu City', 10.3058, 123.8912),
('0730600066', 'San Antonio',         'Cebu City', 10.3019, 123.8983),
('0730600067', 'San Jose',            'Cebu City', 10.3791, 123.9164),
('0730600068', 'San Nicolas Central', 'Cebu City', 10.2949, 123.8905),
('0730600069', 'San Roque',           'Cebu City', 10.2939, 123.9060),
('0730600070', 'Santa Cruz',          'Cebu City', 10.3061, 123.8959),
('0730600071', 'Sawang Calero',       'Cebu City', 10.2912, 123.8908),
('0730600073', 'Sinsin',              'Cebu City', 10.3449, 123.7810),
('0730600074', 'Sirao',               'Cebu City', 10.4141, 123.8722),
('0730600075', 'Suba Pob.',           'Cebu City', 10.2900, 123.8938),
('0730600076', 'Sudlon I',            'Cebu City', 10.3636, 123.7863),
('0730600077', 'Sapangdaku',          'Cebu City', 10.3350, 123.8727),
('0730600078', 'T. Padilla',          'Cebu City', 10.3018, 123.9043),
('0730600079', 'Tabunan',             'Cebu City', 10.4397, 123.8214),
('0730600080', 'Tagbao',              'Cebu City', 10.4425, 123.8399),
('0730600081', 'Talamban',            'Cebu City', 10.3694, 123.9169),
('0730600082', 'Taptap',              'Cebu City', 10.4299, 123.8480),
('0730600083', 'Tejero',              'Cebu City', 10.3020, 123.9074),
('0730600084', 'Tinago',              'Cebu City', 10.2986, 123.9081),
('0730600085', 'Tisa',                'Cebu City', 10.3021, 123.8690),
('0730600086', 'To-ong Pardo',        'Cebu City', 10.3100, 123.8362),
('0730600087', 'Zapatera',            'Cebu City', 10.3064, 123.9013),
('0730600088', 'Sudlon II',           'Cebu City', 10.3796, 123.7847)
ON CONFLICT (barangay_code) DO UPDATE SET
    barangay_name = EXCLUDED.barangay_name,
    latitude      = COALESCE(barangays.latitude, EXCLUDED.latitude),
    longitude     = COALESCE(barangays.longitude, EXCLUDED.longitude);

-- Merge same-named placeholder barangays into the official rows.
CREATE TEMP TABLE barangay_merge ON COMMIT DROP AS
SELECT old.barangay_code AS old_code, official.barangay_code AS new_code
FROM barangays old
JOIN barangays official
  ON lower(regexp_replace(old.barangay_name, '[^A-Za-z0-9]', '', 'g'))
   = lower(regexp_replace(official.barangay_name, '[^A-Za-z0-9]', '', 'g'))
WHERE official.barangay_code ~ '^07306[0-9]{5}$'
  AND old.barangay_code !~ '^07306[0-9]{5}$'
  AND old.city_municipality ILIKE 'Cebu City';

UPDATE lgu_offices o SET barangay_code = m.new_code FROM barangay_merge m WHERE o.barangay_code = m.old_code;
UPDATE demand_logs d SET barangay_code = m.new_code FROM barangay_merge m WHERE d.barangay_code = m.old_code;
DELETE FROM barangays b USING barangay_merge m WHERE b.barangay_code = m.old_code;

COMMIT;
