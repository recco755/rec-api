-- Run once: track consumer "liked" boost deliveries (Flash → Likes tab).
ALTER TABLE service_boost_delivery ADD COLUMN liked_at DATETIME NULL;
CREATE INDEX idx_consumer_liked_active ON service_boost_delivery (consumer_user_id, expires_at, liked_at, dismissed_at);
