-- Run once on existing DBs that already have service_boost.
ALTER TABLE service_boost ADD COLUMN location_address TEXT DEFAULT NULL;
ALTER TABLE service_boost ADD COLUMN location_latitude DOUBLE DEFAULT NULL;
ALTER TABLE service_boost ADD COLUMN location_longitude DOUBLE DEFAULT NULL;
