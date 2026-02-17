-- Add repeated_customer_commission column (same style as commission_guideline)
-- Run this once on your database so the new field is saved.

ALTER TABLE business_details
  ADD COLUMN repeated_customer_commission TEXT NULL AFTER commission_guideline;

ALTER TABLE services
  ADD COLUMN repeated_customer_commission TEXT NULL AFTER commission_guideline;
