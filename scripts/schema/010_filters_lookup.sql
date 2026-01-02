-- 010_filters_lookup.sql
-- Create filters lookup table and migrate layers.type to layers.filter_id

-- 1. Clear existing layer data (ok to lose for this migration)
DELETE FROM drawkiss.layers;

-- 2. Create filters lookup table (system-wide, no user_id)
CREATE TABLE IF NOT EXISTS drawkiss.filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Seed with all available filters (artist-friendly names)
INSERT INTO drawkiss.filters (code, name, description, sort_order) VALUES
  ('posterize',          'Posterize',      'Reduce to limited tones for value study', 1),
  ('edges',              'Edges',          'Detect outlines and contours', 2),
  ('blur',               'Squint',         'Blur details like squinting at your subject', 3),
  ('threshold',          'High Contrast',  'Pure black and white, no grays', 4),
  ('adaptive_threshold', 'Local Contrast', 'Adapts to lighting across the image', 5),
  ('bilateral',          'Smooth',         'Smooth surfaces while keeping edges sharp', 6),
  ('invert',             'Invert',         'Flip light and dark', 7),
  ('contrast',           'Punch',          'Increase contrast', 8),
  ('median',             'Simplify',       'Remove noise and tiny details', 9),
  ('contours',           'Shapes',         'Detect main shape outlines only', 10),
  ('pencil_sketch',      'Sketch',         'Simulated pencil effect', 11);

-- 4. Drop the old type column and constraint from layers
ALTER TABLE drawkiss.layers DROP CONSTRAINT IF EXISTS valid_layer_type;
ALTER TABLE drawkiss.layers DROP COLUMN IF EXISTS type;

-- 5. Add filter_id column with foreign key
ALTER TABLE drawkiss.layers 
  ADD COLUMN filter_id UUID NOT NULL REFERENCES drawkiss.filters(id);

-- 6. Create index for filter lookups
CREATE INDEX IF NOT EXISTS idx_layers_filter_id ON drawkiss.layers(filter_id);

-- 7. Grant access to filters table
GRANT SELECT ON drawkiss.filters TO anon;
GRANT SELECT ON drawkiss.filters TO authenticated;
GRANT ALL ON drawkiss.filters TO service_role;

-- 8. Comments
COMMENT ON TABLE drawkiss.filters IS 'System-wide filter definitions for image processing';
COMMENT ON COLUMN drawkiss.filters.code IS 'Technical filter code used by OpenCV processing';
COMMENT ON COLUMN drawkiss.filters.name IS 'Artist-friendly display name';
COMMENT ON COLUMN drawkiss.filters.description IS 'Help text explaining what the filter does';

