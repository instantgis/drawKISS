-- 004_layers_table.sql
-- Create layers table for processed image layers (like Photoshop layer stack)

CREATE TABLE IF NOT EXISTS drawkiss.layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES drawkiss.images(id) ON DELETE CASCADE,
  name TEXT,
  type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  param_value INT,
  layer_order INT DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  opacity INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure valid layer types
  CONSTRAINT valid_layer_type CHECK (
    type IN ('posterize', 'edges', 'blur', 'threshold')
  ),
  
  -- Ensure opacity is 0-100
  CONSTRAINT valid_opacity CHECK (
    opacity >= 0 AND opacity <= 100
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_layers_image_id 
  ON drawkiss.layers(image_id);

CREATE INDEX IF NOT EXISTS idx_layers_order 
  ON drawkiss.layers(image_id, layer_order);

COMMENT ON TABLE drawkiss.layers IS 'Processed image layers for easel stack';
COMMENT ON COLUMN drawkiss.layers.name IS 'User-friendly layer label';
COMMENT ON COLUMN drawkiss.layers.type IS 'Layer type: posterize, edges, blur, threshold';
COMMENT ON COLUMN drawkiss.layers.storage_path IS 'Supabase storage path: layers/{id}.png';
COMMENT ON COLUMN drawkiss.layers.param_value IS 'Primary parameter value (meaning depends on type)';
COMMENT ON COLUMN drawkiss.layers.layer_order IS 'Z-index for stacking (higher = on top)';
COMMENT ON COLUMN drawkiss.layers.visible IS 'Layer visibility toggle';
COMMENT ON COLUMN drawkiss.layers.opacity IS 'Layer opacity (0-100)';

