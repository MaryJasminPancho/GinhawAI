CREATE TABLE barangays (
    barangay_code     VARCHAR(20) PRIMARY KEY,
    barangay_name     VARCHAR(255) NOT NULL,
    city_municipality VARCHAR(255) NOT NULL
);

CREATE TABLE lgu_offices (
    office_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_name      VARCHAR(255) NOT NULL,
    address          TEXT,
    barangay_code    VARCHAR(20) REFERENCES barangays(barangay_code),
    contact_number   VARCHAR(50),
    operating_hours  VARCHAR(255)
);

ALTER TABLE admin_users
ADD CONSTRAINT fk_admin_users_office
FOREIGN KEY (office_id) REFERENCES lgu_offices(office_id);