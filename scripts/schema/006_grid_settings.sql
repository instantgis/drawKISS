-- Add grid settings columns to images table for persisting easel grid configuration
-- Run with: . .\scripts\db\use-vps-supabase.ps1; npm run db:sql:json -- (Get-Content .\scripts\schema\006_grid_settings.sql -Raw)

ALTER TABLE drawkiss.images 
ADD COLUMN IF NOT EXISTS grid_rows integer DEFAULT 5;

ALTER TABLE drawkiss.images 
ADD COLUMN IF NOT EXISTS grid_cols integer DEFAULT 5;

COMMENT ON COLUMN drawkiss.images.grid_rows IS 'Number of grid rows for easel view';
COMMENT ON COLUMN drawkiss.images.grid_cols IS 'Number of grid columns for easel view';

