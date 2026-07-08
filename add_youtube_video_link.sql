-- YouTube video link for service carousel (first slide when enabled)
ALTER TABLE services ADD COLUMN youtube_video_link VARCHAR(500) DEFAULT NULL;
ALTER TABLE services ADD COLUMN show_youtube_on_cards TINYINT NOT NULL DEFAULT 1;
