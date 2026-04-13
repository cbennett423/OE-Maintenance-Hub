-- Phase 6 migration: create storage bucket for telematics file uploads
-- Run this in the Supabase SQL editor before uploading files on the Reports page.

INSERT INTO storage.buckets (id, name, public)
VALUES ('telematics-uploads', 'telematics-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload/read/delete files
CREATE POLICY "Auth users can upload telematics files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'telematics-uploads');

CREATE POLICY "Auth users can read telematics files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'telematics-uploads');

CREATE POLICY "Auth users can delete telematics files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'telematics-uploads');
