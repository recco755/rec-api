-- Prevent new business-owner service create from failing when optional
-- youtube flag is sent as NULL (DEFAULT is ignored if the column is SET).
DROP TRIGGER IF EXISTS trg_services_youtube_default;
CREATE TRIGGER trg_services_youtube_default
BEFORE INSERT ON services
FOR EACH ROW
SET NEW.show_youtube_on_cards = IFNULL(NEW.show_youtube_on_cards, 1),
    NEW.is_accepting_recommendations = IFNULL(NEW.is_accepting_recommendations, 1);

-- Allow longer business owner form values (addresses were truncating at 45).
ALTER TABLE business_details
  MODIFY full_name VARCHAR(255) NULL,
  MODIFY email VARCHAR(255) NULL,
  MODIFY business_name VARCHAR(255) NULL,
  MODIFY address VARCHAR(512) NULL,
  MODIFY business_type VARCHAR(255) NULL,
  MODIFY shop_license VARCHAR(255) NULL;

ALTER TABLE services
  MODIFY business_name VARCHAR(255) NULL,
  MODIFY service VARCHAR(255) NULL,
  MODIFY address VARCHAR(512) NULL,
  MODIFY business_type VARCHAR(255) NULL,
  MODIFY business_license VARCHAR(255) NULL,
  MODIFY time VARCHAR(255) NULL,
  MODIFY availability VARCHAR(64) NULL;
