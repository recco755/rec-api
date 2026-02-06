-- Optional: create or align user_devices table for FCM token storage.
-- The API expects: user_id, fcm_token, platform, created_at, updated_at
-- and UNIQUE(user_id, fcm_token) for ON DUPLICATE KEY UPDATE.

CREATE TABLE IF NOT EXISTS user_devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  fcm_token VARCHAR(512) NOT NULL,
  platform VARCHAR(32) DEFAULT 'android',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_token (user_id, fcm_token)
);
