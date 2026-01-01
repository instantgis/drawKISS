-- 001_create_schema.sql
-- Create drawkiss schema with same permissions as public

-- Create the schema
CREATE SCHEMA IF NOT EXISTS drawkiss;

-- Grant usage to standard Supabase roles
GRANT USAGE ON SCHEMA drawkiss TO anon;
GRANT USAGE ON SCHEMA drawkiss TO authenticated;
GRANT USAGE ON SCHEMA drawkiss TO service_role;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT ALL ON TABLES TO service_role;

-- Grant default privileges for sequences (needed for serial/identity columns)
ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT USAGE, SELECT ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA drawkiss
  GRANT ALL ON SEQUENCES TO service_role;

