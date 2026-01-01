-- 003_images_table.sql
-- Create images table for captured raw images

CREATE TABLE IF NOT EXISTS drawkiss.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES drawkiss.categories(id) ON DELETE SET NULL,
  title TEXT,
  date_taken TIMESTAMPTZ,
  raw_path TEXT NOT NULL,
  thumbnail_path TEXT,
  width INT,
  height INT,
  file_size_bytes INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_category_id 
  ON drawkiss.images(category_id);

CREATE INDEX IF NOT EXISTS idx_images_created_at 
  ON drawkiss.images(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_images_date_taken 
  ON drawkiss.images(date_taken DESC);

COMMENT ON TABLE drawkiss.images IS 'Captured raw images metadata';
COMMENT ON COLUMN drawkiss.images.raw_path IS 'Supabase storage path: raw/{id}.png';
COMMENT ON COLUMN drawkiss.images.thumbnail_path IS 'Supabase storage path: thumbs/{id}.png';

