-- Add carousel image columns to services table
-- Run this SQL in your database to add support for carousel images

USE recommendo;

ALTER TABLE services 
ADD COLUMN carousel_image_1 VARCHAR(500) DEFAULT NULL,
ADD COLUMN carousel_image_2 VARCHAR(500) DEFAULT NULL,
ADD COLUMN carousel_image_3 VARCHAR(500) DEFAULT NULL;
