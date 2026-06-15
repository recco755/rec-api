-- Deliveries when a user pushes their circle query to selected contacts.
CREATE TABLE IF NOT EXISTS circle_query_delivery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_user_id INT NOT NULL,
  recipient_user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  dismissed_at DATETIME NULL,
  liked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  KEY idx_recipient_active (recipient_user_id, expires_at, dismissed_at, liked_at),
  KEY idx_requester (requester_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
