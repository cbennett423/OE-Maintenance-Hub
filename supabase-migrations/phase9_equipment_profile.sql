-- Phase 9 migration: extended equipment profile fields
-- Adds photo, specs, documents, Product Link telematics info, and wear
-- parts tracking to the equipment table. Also creates a public storage
-- bucket for photos and document uploads.

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS make TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS year INTEGER,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS weight TEXT,
  ADD COLUMN IF NOT EXISTS bucket_size TEXT,
  ADD COLUMN IF NOT EXISTS product_link_radio TEXT,
  ADD COLUMN IF NOT EXISTS product_link_radio_software TEXT,
  ADD COLUMN IF NOT EXISTS product_link_ecm TEXT,
  ADD COLUMN IF NOT EXISTS product_link_ecm_software TEXT,
  ADD COLUMN IF NOT EXISTS wear_parts JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Public storage bucket for equipment photos and documents.
-- Public so photos can be embedded via img tag and documents downloaded.
-- Only authenticated users can upload/delete.
INSERT INTO storage.buckets (id, name, public)
VALUES ('equipment-files', 'equipment-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload equipment files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'equipment-files');

CREATE POLICY "Public read equipment files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'equipment-files');

CREATE POLICY "Auth users delete equipment files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'equipment-files');
