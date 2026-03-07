-- Add columns to control visibility of email/phone on service cards.
-- Run this once on your database (e.g. recommendo). Skip if columns already exist.
USE recommendo;

ALTER TABLE user ADD COLUMN show_email_on_cards TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE user ADD COLUMN show_phone_on_cards TINYINT(1) NOT NULL DEFAULT 1;
