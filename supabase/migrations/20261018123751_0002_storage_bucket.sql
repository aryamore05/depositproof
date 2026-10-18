/*
# Property photos storage bucket

1. Storage
- Create a public bucket `property-photos` for storing uploaded evidence
  photos. Public read is required so the frontend can render images via
  signed/public URLs. Files are addressed by a server-generated UUID path,
  never user-supplied filenames.

2. Security
- Storage policies: anon + authenticated can read, insert, update, delete
  objects in `property-photos`. Single-tenant MVP — data is intentionally
  shared within the project.
*/

INSERT INTO storage.buckets (id, name, public) VALUES ('property-photos', 'property-photos', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_read_photos" ON storage.objects;
CREATE POLICY "anon_read_photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "anon_insert_photos" ON storage.objects;
CREATE POLICY "anon_insert_photos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "anon_update_photos" ON storage.objects;
CREATE POLICY "anon_update_photos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'property-photos') WITH CHECK (bucket_id = 'property-photos');

DROP POLICY IF EXISTS "anon_delete_photos" ON storage.objects;
CREATE POLICY "anon_delete_photos" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'property-photos');
