-- Rows created when a business owner "pushes" their boost card to selected contacts.
-- Consumers see the overlay on Home while expires_at is in the future and dismissed_at is null.
CREATE TABLE IF NOT EXISTS service_boost_delivery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_user_id INT NOT NULL,
  consumer_user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  dismissed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY idx_consumer_active (consumer_user_id, expires_at, dismissed_at),
  KEY idx_provider (provider_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
