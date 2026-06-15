-- Circle query: one saved query per user (consumer mood).
CREATE TABLE IF NOT EXISTS circle_query (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
