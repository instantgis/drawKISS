-- 007_progress_photos_table.sql
-- Create progress_photos table for WIP and final artwork photos

CREATE TABLE IF NOT EXISTS drawkiss.progress_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  image_id UUID NOT NULL REFERENCES drawkiss.images(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  notes TEXT,
  is_final BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_progress_photos_image_id 
  ON drawkiss.progress_photos(image_id);

CREATE INDEX IF NOT EXISTS idx_progress_photos_user_id 
  ON drawkiss.progress_photos(user_id);

CREATE INDEX IF NOT EXISTS idx_progress_photos_created_at 
  ON drawkiss.progress_photos(created_at DESC);

-- RLS policies
ALTER TABLE drawkiss.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress photos"
  ON drawkiss.progress_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress photos"
  ON drawkiss.progress_photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress photos"
  ON drawkiss.progress_photos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress photos"
  ON drawkiss.progress_photos FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE drawkiss.progress_photos IS 'Work-in-progress and final artwork photos linked to reference images';
COMMENT ON COLUMN drawkiss.progress_photos.image_id IS 'FK to the reference image this progress photo belongs to';
COMMENT ON COLUMN drawkiss.progress_photos.storage_path IS 'Supabase storage path: {user_id}/progress/{id}.png';
COMMENT ON COLUMN drawkiss.progress_photos.is_final IS 'True if this is the completed artwork';

