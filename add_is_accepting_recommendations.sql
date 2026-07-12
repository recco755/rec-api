-- Business owner availability for new recommendations (1 = green/active, 0 = red/hidden from Select service)
ALTER TABLE services
  ADD COLUMN is_accepting_recommendations TINYINT NOT NULL DEFAULT 1;
