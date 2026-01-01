-- Migration: Secure drawkiss storage bucket with user-based RLS
-- Path structure: {user_id}/raw/{id}.png and {user_id}/layers/{id}.png

-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'drawkiss';

-- 2. Drop old permissive policies
DROP POLICY IF EXISTS "drawkiss images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to drawkiss" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update drawkiss images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete drawkiss images" ON storage.objects;

-- 3. Create new user-scoped policies
-- Users can read their own files (folder name = user_id)
CREATE POLICY "Users can read own drawkiss files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'drawkiss' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can upload to their own folder
CREATE POLICY "Users can upload to own drawkiss folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'drawkiss' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own files
CREATE POLICY "Users can update own drawkiss files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'drawkiss' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own files
CREATE POLICY "Users can delete own drawkiss files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'drawkiss' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

