-- Migration: Add user_id to all tables and enable RLS
-- This enables multi-user support where each user has their own data

-- 1. Clear test data (order matters due to FK constraints)
DELETE FROM drawkiss.layers;
DELETE FROM drawkiss.images;
DELETE FROM drawkiss.categories;

-- 2. Add user_id column to all tables
ALTER TABLE drawkiss.categories
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE drawkiss.images
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE drawkiss.layers
  ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Create indexes for performance
CREATE INDEX idx_categories_user_id ON drawkiss.categories(user_id);
CREATE INDEX idx_images_user_id ON drawkiss.images(user_id);
CREATE INDEX idx_layers_user_id ON drawkiss.layers(user_id);

-- 4. Enable Row Level Security
ALTER TABLE drawkiss.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawkiss.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawkiss.layers ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for categories
CREATE POLICY categories_select ON drawkiss.categories
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY categories_insert ON drawkiss.categories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY categories_update ON drawkiss.categories
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY categories_delete ON drawkiss.categories
  FOR DELETE USING (user_id = auth.uid());

-- 6. Create RLS policies for images
CREATE POLICY images_select ON drawkiss.images
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY images_insert ON drawkiss.images
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY images_update ON drawkiss.images
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY images_delete ON drawkiss.images
  FOR DELETE USING (user_id = auth.uid());

-- 7. Create RLS policies for layers
CREATE POLICY layers_select ON drawkiss.layers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY layers_insert ON drawkiss.layers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY layers_update ON drawkiss.layers
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY layers_delete ON drawkiss.layers
  FOR DELETE USING (user_id = auth.uid());

-- 8. Grant permissions to authenticated users
GRANT USAGE ON SCHEMA drawkiss TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drawkiss.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drawkiss.images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drawkiss.layers TO authenticated;

