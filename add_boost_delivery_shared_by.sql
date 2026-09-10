-- Friend-to-friend share of a flash deal card.
-- Recipients see the same offer with "Shared by {name}" on the card.
-- Safe to re-run: skips columns/indexes that already exist.

USE recommendo;

SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'service_boost_delivery'
    AND COLUMN_NAME = 'shared_by_user_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_boost_delivery ADD COLUMN shared_by_user_id INT NULL',
  'SELECT ''shared_by_user_id already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'service_boost_delivery'
    AND COLUMN_NAME = 'source_delivery_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE service_boost_delivery ADD COLUMN source_delivery_id INT NULL',
  'SELECT ''source_delivery_id already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'service_boost_delivery'
    AND INDEX_NAME = 'idx_boost_shared_by'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_boost_shared_by ON service_boost_delivery (shared_by_user_id)',
  'SELECT ''idx_boost_shared_by already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'service_boost_delivery'
    AND INDEX_NAME = 'idx_boost_source_delivery'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_boost_source_delivery ON service_boost_delivery (source_delivery_id)',
  'SELECT ''idx_boost_source_delivery already exists'' AS info'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
