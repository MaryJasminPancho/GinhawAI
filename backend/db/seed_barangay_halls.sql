-- Barangay halls of Cebu City, gathered by the team from Google Maps, Waze and the
-- barangays' Facebook pages (source + date per row below). Safe to re-run: an existing
-- hall for the barangay (any office named "Barangay ..." / "Brgy. ...") is updated,
-- otherwise one is added. Names start with "Barangay" so the app shows each hall
-- only to residents of that barangay.
--
-- Run after seed_cebu_city_barangays.sql:
--   psql -U postgres -d ginhawai -f backend/db/seed_barangay_halls.sql
--
-- Central = Barangay Señor Santo Niño (renamed; same PSGC code).
-- To re-check (saved as given):
--   Basak Pardo: phone (02) 268 4100 uses Manila's (02) area code; Cebu is (032); listed as open 24 hours
--   Binaliw: closing time written as 5:00 AM, saved as 5:00 PM
--   Buhisan: phone (02) 234 1468 uses Manila's (02) area code; Cebu is (032); listed as open 24 hours
--   Bulacao: no contact number
--   Buot-Taup Pardo: listed as open 24 hours
--   Central: listed as open 24 hours
--   Day-as: listed as open 24 hours
--   Guadalupe: listed as open 24 hours
--   Tejero: phone (032) 601 764 is missing a digit

-- The file is UTF-8 (–, ñ); without this, psql on Windows reads it as WIN1252 and garbles them.
SET client_encoding = 'UTF8';

CREATE TEMP TABLE hall_rows (office_name text, address text, barangay_code text, contact_number text, operating_hours text, source text);
INSERT INTO hall_rows VALUES
  ('Barangay Adlaon Hall', 'Sitio Kang-Atis, Barangay Adlaon, Cebu City', '0730600001', '(032) 513 5511', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google, 2026-10-24'),
  ('Barangay Agsungot Hall', 'Barangay Agsungot, Cebu City', '0730600002', '(032) 254 6520', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Apas Hall', 'Banogon St., Apas, Cebu City', '0730600003', '0960 929 2224', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Philippines(.)tv, 2026-10-24'),
  ('Barangay Babag Hall', 'Hamtik, Babag, Cebu City', '0730600004', '(032) 340 1864', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Philippines(.)tv, 2026-10-24'),
  ('Barangay Basak Pardo Hall', 'Julian Jumalon St, Cebu City', '0730600005', '(02) 268 4100', 'Mon–Sun, Open 24 hours', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Bacayan Hall', 'Upper Bacayan, Cebu City', '0730600006', '(032) 384 6183', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Banilad Hall', '888 Gov. M. Cuenco Ave, Cebu City', '0730600007', '(032) 346 0385', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Basak San Nicolas Hall', 'Rizal Avenue, Ext, Cebu City', '0730600008', '(032) 418 9898', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Binaliw Hall', 'Tabo-Tabo Street, Barangay Binaliw, Cebu City', '0730600010', '0917 143 6526', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Bonbon Hall', 'Bonbon Barangay Hall, Cebu City', '0730600011', '0947 472 1743', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Budla-an Hall', 'Budlaan Proper, Cebu City', '0730600013', '0916 763 9782', 'Mon–Sun, 6:00 AM – 11:00 PM', 'Brgy. Facebook page, Google Maps listing, 2026-10-24'),
  ('Barangay Buhisan Hall', 'Buhisan Proper, Buhisan, Cebu City', '0730600014', '(02) 234 1468', 'Mon–Sun, Open 24 hours', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Bulacao Hall', 'Cebu S Rd, Cebu City', '0730600015', NULL, 'Mon–Fri, 8:00 AM – 5:00 PM', 'Waze, Google Maps listing, 2026-10-24'),
  ('Barangay Buot-Taup Pardo Hall', 'National Road, Buot, Cebu City', '0730600016', '0951 780 2135', 'Mon–Sun, Open 24 hours', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Busay Hall', 'Nivel Hills, Barangay Busay, Cebu City', '0730600017', '0947 764 4934', 'Mon–Sat, 8:00 AM – 12:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Calamba Hall', '28 Lucio Lopez Drive, Cebu City', '0730600018', '(032) 517 9988 / 0945 213 1510', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Official Website, Brgy. Facebook page, 2026-10-24'),
  ('Barangay Cambinocot Hall', 'Barangay Cambinocot, Cebu City', '0730600019', '0928 608 4953', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Capitol Site Hall', 'A. Villalon Dr, Cebu City', '0730600020', '0919 630 3564', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Carreta Hall', 'General Maxilom Extension, Cebu City', '0730600021', '(032) 345 9271', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Señor Santo Niño Hall', '032 Legaspi St, Cebu City', '0730600022', '(032) 346 8802', 'Mon–Sun, Open 24 hours', 'Google Maps listing, 2026-10-24'),
  ('Barangay Cogon Ramos Hall', 'F. Ramos St, Cebu City', '0730600023', '(032) 415 5599', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Cogon Pardo Hall', 'A. Gabuya St, Cebu City', '0730600024', '(032) 272 3211', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Day-as Hall', '1 Sikatuna St, Cebu City', '0730600025', '(032) 256 3168', 'Mon–Sun, Open 24 hours', 'Google Maps listing, 2026-10-24'),
  ('Barangay Duljo Hall', 'Spolarium Street, Cebu City', '0730600027', '(032) 262 2012', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Philippines(.)tv, Google Maps listing, 2026-10-24'),
  ('Barangay Ermita Hall', 'Kawit Street, Cebu City', '0730600028', '(032) 255 2096', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Guadalupe Hall', 'V Rama Ave, Cebu City', '0730600029', '0932 283 7896', 'Mon–Fri, 8:00 AM – 5:00 PM; Sat–Sun, Open 24 hours', 'Polomap, Google Maps listing, 2026-10-24'),
  ('Barangay Guba Hall', 'Proper Guba, Cebu City', '0730600030', '0927 585 7114', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Hippodromo Hall', '664 St Joseph, Cebu City', '0730600031', '(032) 233 1311', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Inayawan Hall', 'F. Jaca St, Cebu City', '0730600032', '(032) 272 2628', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Kalubihan Hall', 'Pantaleon del Rosario St, Cebu City', '0730600033', '(032) 418 4536', 'Mon–Sat, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Kalunasan Hall', 'Unit 3 OPRRA Village, Brgy. Kalunasan, Cebu City', '0730600034', '(032) 253-7277', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Kamagayan Hall', 'Pantaleon del Rosario St, Cebu City', '0730600035', '(032) 416 8007', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Camputhaw Hall', '15 N Escario St, Cebu City', '0730600036', '(032) 255 1663', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Kasambagan Hall', 'Pres.Quezon St. Villa Aurora Kasambagan Cebu City', '0730600037', '(032) 233 9981', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Polomap, 2026-10-24'),
  ('Barangay Kinasang-an Pardo Hall', '564 Cebu S Rd, Cebu City', '0730600038', '(032) 344 3651', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Google Maps listing, 2026-10-24'),
  ('Barangay Labangon Hall', '132 Katipunan St, Cebu City', '0730600040', '(032) 402 3020', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Google Maps listing, 2026-10-24'),
  ('Barangay Lahug Hall', '168 Gorordo Ave, Cebu City', '0730600041', '032 234-6813 / 0933 139-5898', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Official Website, Brgy. Facebook page, 2026-10-24'),
  ('Barangay Lorega Hall', 'Lorega St, Cebu City', '0730600042', '(032) 416 7174', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Polomap, Google Maps listing, 2026-10-24'),
  ('Barangay Lusaran Hall', 'Lusaran, Cebu City', '0730600043', '0933 603 1208', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Luz Hall', '15H P. Cabantan, Bo. Luz, Cebu City', '0730600044', '(032) 341-6020 / 0928 596 2833', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Official Website, Brgy. Facebook page, 2026-10-24'),
  ('Barangay Mabini Hall', 'Barangay Mabini Road, Barangay Mabini, Cebu City', '0730600045', '0929 507 6718', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Waze, Google Maps listing, 2026-10-24'),
  ('Barangay Mabolo Hall', 'M.J. Cuenco Avenue, Mabolo, Cebu City', '0730600046', '(032) 253 3003', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Malubog Hall', 'Cebu Transcentral Highway, Cebu City', '0730600048', '0918 388 5593', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Waze, Google Maps listing, 2026-10-24'),
  ('Barangay Mambaling Hall', 'Ma. Gochan St., Mambaling, Cebu City', '0730600049', '(032) 266 5099', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Philippines(.)tv, Brgy. Facebook page, 2026-10-24'),
  ('Barangay Pahina Central Hall', 'Panganiban Street, Barangay Pahina Central, Cebu City', '0730600050', '(032) 255 1655', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Pahina San Nicolas Hall', '23-53 Candido Padilla St, Cebu City', '0730600051', '0932 242 5810', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Waze, 2026-10-24'),
  ('Barangay Pamutan Hall', 'Barangay Pamutan, Cebu City', '0730600052', '0916 109 3219', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Pardo Hall', 'M. Dacalos Street, Barangay Poblacion Pardo, Cebu City', '0730600053', '(032) 273 0844', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Pari-an Hall', 'Sikatuna St, Cebu City', '0730600054', '(032) 254 5002', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Philippines(.)tv, Google Maps listing, 2026-10-24'),
  ('Barangay Paril Hall', 'National Highway, Barangay Paril, Cebu City', '0730600055', '0918 687 8427', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Pasil Hall', 'Anix Bldg, L. Flores St., Pasil, Cebu City', '0730600056', '(032) 266 5265', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page,Google Maps listing, 2026-10-24'),
  ('Barangay Pit-os Hall', 'Barangay Pit-os, Cebu City', '0730600057', '(032) 401 1894', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Pulangbato Hall', 'Upper Tanay Road, Pulangbato, Cebu City', '0730600059', '(032) 342 8794', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Pung-ol-Sibugay Hall', 'National Road, Cebu City', '0730600060', '0919 737 0254', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Punta Princesa Hall', '1085 A Tres de Abril St, Cebu City', '0730600062', '0932 525 4296', 'Mon–Sun, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Quiot Pardo Hall', 'UBCA, Quiot Pardo, Cebu City', '0730600063', '(032) 422 8014', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Sambag I Hall', 'J. Alcantara St, Cebu City', '0730600064', '(032) 254 7590', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sambag II Hall', 'Sambag 2, Cebu City', '0730600065', '0931 036 2958', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay San Antonio Hall', 'Don Pedro Cui, Cebu City', '0730600066', '(032) 254 6734', 'Mon–Sun, 9:00 AM – 5:00 PM', 'Waze, Google Maps listing, 2026-10-24'),
  ('Barangay San Jose Hall', 'San Jose-Antuanga Road, Barangay San Jose Cebu City', '0730600067', '(032) 262-1424', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Waze, Google Maps listing, 2026-10-24'),
  ('Barangay San Nicolas Central Hall', 'T. Abella Street, Cebu City', '0730600068', '(032) 509 3026', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay San Roque Hall', 'San Roque Barangay Hall, Arellano Blvd, Cebu City', '0730600069', '(032) 416 6900', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Santa Cruz Hall', 'F. Ramos Extension, Cebu City', '0730600070', '(032) 254 3872', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Polomap, Waze, 2026-10-24'),
  ('Barangay Sawang Calero Hall', 'Multi-Purpose Building, Tupas Street, Cebu City', '0730600071', '(032) 262 9078', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sinsin Hall', 'Sinsin, GWS, Cebu City', '0730600073', '0917 275 2224', 'Mon–Sun, 8:00 AM – 3:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sirao Hall', 'Barangay Sirao, Cebu City', '0730600074', '0909 662 3698', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Suba Hall', 'L. Abellar St, Cebu City', '0730600075', '(032) 418 3040', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sudlon I Hall', 'Camp 7–Sudlon Road, Cebu City', '0730600076', '(032) 514-5901', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sapangdaku Hall', 'Sitio Caimitohan, Barangay Sapangdaku, Cebu City', '0730600077', '0942 936 3253', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay T. Padilla Hall', 'T. Villa Street, Barangay T. Padilla, Cebu City', '0730600078', '(032) 345 3027', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Tabunan Hall', 'Barangay Tabunan, Cebu City', '0730600079', '0928 226 1979', 'Mon–Sat, 8:00 AM – 6:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Tagbao Hall', 'Barangay Road, Tagbao, Cebu City', '0730600080', '0949 735 4565', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Talamban Hall', 'Gov. M. Cuenco Avenue, Cebu City', '0730600081', '0917 143 4782', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Polomap, Google Maps listing, 2026-10-24'),
  ('Barangay Taptap Hall', 'Upas, Barangay Taptap, Cebu City', '0730600082', '(032) 419 3152', 'Mon–Sun, 9:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Tejero Hall', 'T. Padilla Extension, Barangay Tejero, Cebu City', '0730600083', '(032) 601 764', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Google Maps listing, 2026-10-24'),
  ('Barangay Tinago Hall', 'C J Cuizon St, Cebu City', '0730600084', '(032) 413 1197', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Polomap, Google Maps listing, 2026-10-24'),
  ('Barangay Tisa Hall', 'Francisco Llamas St, Cebu City', '0730600085', '(032) 262 8784', 'Mon–Sat, 8:00 AM – 6:00 PM', 'Polomap, Google Maps listing, 2026-10-24'),
  ('Barangay To-ong Pardo Hall', 'To-ong Pardo, Cebu City', '0730600086', '0905 181 8870', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, 2026-10-24'),
  ('Barangay Zapatera Hall', 'Dionisio Jakosalem St, Cebu City', '0730600087', '(032) 259 9561', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Google Maps listing, 2026-10-24'),
  ('Barangay Sudlon II Hall', 'Cantipla-Sudlon Rd, Cebu City', '0730600088', '0962 849 6523', 'Mon–Fri, 8:00 AM – 5:00 PM', 'Brgy. Facebook page, Waze, 2026-10-24');

UPDATE lgu_offices o
SET office_name = h.office_name, address = h.address, contact_number = h.contact_number, operating_hours = h.operating_hours
FROM hall_rows h
WHERE o.barangay_code = h.barangay_code AND o.office_name ~* '^(barangay|brgy\.?)\s';

INSERT INTO lgu_offices (office_name, address, barangay_code, contact_number, operating_hours)
SELECT h.office_name, h.address, h.barangay_code, h.contact_number, h.operating_hours
FROM hall_rows h
WHERE EXISTS (SELECT 1 FROM barangays b WHERE b.barangay_code = h.barangay_code)
  AND NOT EXISTS (SELECT 1 FROM lgu_offices o WHERE o.barangay_code = h.barangay_code AND o.office_name ~* '^(barangay|brgy\.?)\s');

DROP TABLE hall_rows;
