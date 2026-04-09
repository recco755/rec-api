-- Run once on the recommando database (or your active DB).
-- Stores peer wallet sends for transaction history (with optional note).

CREATE TABLE IF NOT EXISTS wallet_peer_transfer (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sender_user_id INT UNSIGNED NOT NULL,
  recipient_user_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sender (sender_user_id),
  KEY idx_recipient (recipient_user_id),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
