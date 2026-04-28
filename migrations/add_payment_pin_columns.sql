-- Run once on the Reccomman MySQL database before using payment PIN features.
-- If columns already exist, skip or remove the lines that fail.
ALTER TABLE `user`
  ADD COLUMN `payment_pin_hash` VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN `payment_pin_reset_until` DATETIME NULL DEFAULT NULL;
