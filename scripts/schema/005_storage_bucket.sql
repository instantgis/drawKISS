-- 005_storage_bucket.sql
-- Create drawkiss storage bucket with RLS policies

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'drawkiss',
  'drawkiss',
  true,                                          -- public read
  10485760,                                      -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can read (public bucket)
CREATE POLICY "drawkiss images are publicly accessible"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'drawkiss');

-- Policy: Anyone can upload (no auth for personal tool)
-- In production you'd restrict to authenticated users
CREATE POLICY "Anyone can upload to drawkiss"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'drawkiss');

-- Policy: Anyone can update
CREATE POLICY "Anyone can update drawkiss images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'drawkiss');

-- Policy: Anyone can delete
CREATE POLICY "Anyone can delete drawkiss images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'drawkiss');

