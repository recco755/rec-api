-- Service boost form: one row per user (service provider). Updates replace existing row.
CREATE TABLE IF NOT EXISTS service_boost (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  business_service_name VARCHAR(255) DEFAULT NULL,
  product_name VARCHAR(255) DEFAULT NULL,
  boost_image_url VARCHAR(512) DEFAULT NULL,
  before_price VARCHAR(64) DEFAULT NULL,
  after_price VARCHAR(64) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  phone_number VARCHAR(64) DEFAULT NULL,
  website_link VARCHAR(512) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT NULL,
  updated_at DATETIME DEFAULT NULL,
  KEY idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
