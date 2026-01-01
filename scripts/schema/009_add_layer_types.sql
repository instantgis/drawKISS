-- 009_add_layer_types.sql
-- Add new layer types for additional OpenCV filters

-- Drop the old constraint
ALTER TABLE drawkiss.layers DROP CONSTRAINT IF EXISTS valid_layer_type;

-- Add updated constraint with all layer types
ALTER TABLE drawkiss.layers ADD CONSTRAINT valid_layer_type CHECK (
  type IN (
    'posterize', 'edges', 'blur', 'threshold',           -- original
    'adaptive_threshold', 'bilateral', 'invert',         -- new
    'contrast', 'median', 'contours', 'pencil_sketch'    -- new
  )
);

COMMENT ON COLUMN drawkiss.layers.type IS 'Layer type: posterize, edges, blur, threshold, adaptive_threshold, bilateral, invert, contrast, median, contours, pencil_sketch';

