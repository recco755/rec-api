CREATE TABLE IF NOT EXISTS recommendation_reads (
  id INT NOT NULL AUTO_INCREMENT,
  recommendation_id INT NOT NULL,
  user_id INT NOT NULL,
  last_seen_status VARCHAR(64) DEFAULT NULL,
  opened_at DATETIME NOT NULL,
  last_seen_updated_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recommendation_reads_reco_user (recommendation_id, user_id),
  KEY idx_recommendation_reads_user (user_id),
  KEY idx_recommendation_reads_recommendation (recommendation_id)
);
