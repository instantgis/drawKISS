-- 002_categories_table.sql
-- Create categories table for organizing images in gallery

CREATE TABLE IF NOT EXISTS drawkiss.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort_order 
  ON drawkiss.categories(sort_order);

COMMENT ON TABLE drawkiss.categories IS 'Image categories for gallery organization';
COMMENT ON COLUMN drawkiss.categories.name IS 'Category display name';
COMMENT ON COLUMN drawkiss.categories.sort_order IS 'Display order in gallery (lower = first)';

