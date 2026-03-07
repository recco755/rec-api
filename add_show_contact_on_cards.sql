-- Add columns for DISPLAY contact (shown on cards) separate from login email/phone.
-- Run this once on your database (e.g. recommendo). Skip if columns already exist.
USE recommendo;

ALTER TABLE user ADD COLUMN show_email_on_cards TINYINT NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN show_phone_on_cards TINYINT NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN display_email VARCHAR(255) DEFAULT NULL;
ALTER TABLE user ADD COLUMN display_phone VARCHAR(64) DEFAULT NULL;
