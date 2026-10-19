/*
# Media storage bucket

1. Storage
- Create public bucket `media` for post image/video uploads.
- Policies: authenticated users can upload/read objects; each user uploads under a `user_id/` prefix folder.
2. Notes
- 25 MB upload limit is enforced in the app (Supabase free tier allows up to 50MB per object).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "media_read_all" ON storage.objects;
CREATE POLICY "media_read_all" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'media');

DROP POLICY IF EXISTS "media_insert_own" ON storage.objects;
CREATE POLICY "media_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "media_delete_own" ON storage.objects;
CREATE POLICY "media_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
