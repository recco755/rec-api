-- Run this once to fix duplicate user_devices rows (one row per user).
-- Step 1: Remove duplicates, keeping one row per user_id (latest updated_at).
-- Step 2: Add UNIQUE(user_id) so only one device row per user is allowed.

-- 1) Delete duplicate rows, keeping the row with the latest updated_at per user_id.
DELETE d1 FROM user_devices d1
INNER JOIN user_devices d2
WHERE d1.user_id = d2.user_id
  AND d1.updated_at < d2.updated_at;

-- If you have duplicate rows with the same updated_at, keep the one with the larger id.
DELETE d1 FROM user_devices d1
INNER JOIN user_devices d2
WHERE d1.user_id = d2.user_id
  AND d1.id < d2.id;

-- 2) Add UNIQUE on user_id (only if your table doesn't have it already).
-- If you get "Duplicate key name" or similar, the unique key already exists; skip this.
ALTER TABLE user_devices ADD UNIQUE KEY unique_user_id (user_id);
