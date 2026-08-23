-- Run once on the recommando database (or your active DB).
-- Stores the owner's note when a recommendation is denied.

ALTER TABLE recommendations
  ADD COLUMN service_denied_note TEXT NULL AFTER service_denied_at;
