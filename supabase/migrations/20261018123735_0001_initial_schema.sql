/*
# DepositProof initial schema

Single-tenant MVP (no authentication). The app reads and writes as the
anon role for its entire lifetime, so every policy lists
`anon, authenticated`. Data is intentionally shared/public within this
project — there is no per-user isolation in the first pass.

1. New Tables
- `properties` — a rental property record (name, type, dates, landlord contact)
- `rooms` — rooms within a property (type, name)
- `photos` — property photos with metadata, descriptions, damage category,
  condition stage (move-in / maintenance / move-out), AI analysis results,
  capture-timestamp reliability flag
- `checklist_items` — per-room inspection checklist entries with status
  (good / existing-damage / needs-attention / not-inspected), notes, photos
- `maintenance_issues` — maintenance log entries with status timeline
- `maintenance_updates` — chronological status changes & landlord responses
- `timeline_events` — derived event log for the property timeline
- `app_settings` — key/value store for configurable AI backend URL & model

2. Security
- RLS enabled on every table.
- All policies scope `TO anon, authenticated` with `USING (true)` /
  `WITH CHECK (true)` — the data is intentionally shared within this
  single-tenant project (no sign-in screen). This is the documented
  single-tenant pattern, not a fallback.

3. Important notes
- `photos.capture_date` is nullable and paired with `capture_date_reliable`
  (boolean). When capture metadata cannot be verified, capture_date is NULL
  and capture_date_reliable is false — the UI must label it "unavailable".
- `photos.ai_result` stores the structured JSON returned by the Ollama
  vision model (description, suggested_category, observations, confidence,
  uncertainty). It is never treated as definitive proof — only as a
  suggestion the user reviews. `ai_status` records whether analysis ran,
  was skipped, failed, or is unavailable.
- `maintenance_issues.status` is denormalized for quick display; the full
  history lives in `maintenance_updates`.
*/

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  property_type text NOT NULL DEFAULT 'flat',
  move_in_date date,
  expected_move_out_date date,
  landlord_name text,
  landlord_contact text,
  move_out_completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  room_type text NOT NULL DEFAULT 'bedroom',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  description text,
  damage_category text,
  condition_stage text NOT NULL DEFAULT 'move-in',
  notes text,
  upload_timestamp timestamptz NOT NULL DEFAULT now(),
  capture_date timestamptz,
  capture_date_reliable boolean NOT NULL DEFAULT false,
  ai_status text NOT NULL DEFAULT 'pending',
  ai_result jsonb,
  ai_user_confirmed boolean NOT NULL DEFAULT false,
  ai_user_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'not-inspected',
  notes text,
  photo_ids uuid[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  room_id uuid REFERENCES rooms(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'reported',
  date_reported timestamptz NOT NULL DEFAULT now(),
  landlord_response text,
  resolution_notes text,
  resolution_photos uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS maintenance_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES maintenance_issues(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_property ON rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_photos_room ON photos(room_id);
CREATE INDEX IF NOT EXISTS idx_photos_property_stage ON photos(property_id, condition_stage);
CREATE INDEX IF NOT EXISTS idx_checklist_room ON checklist_items(room_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance_issues(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_updates_issue ON maintenance_updates(issue_id);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Single-tenant: all tables are intentionally shared. Anon + authenticated
-- both get full CRUD. This is the documented single-tenant pattern.
DROP POLICY IF EXISTS "anon_all_properties" ON properties;
CREATE POLICY "anon_all_properties" ON properties FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_properties" ON properties;
CREATE POLICY "anon_ins_properties" ON properties FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_properties" ON properties;
CREATE POLICY "anon_upd_properties" ON properties FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_properties" ON properties;
CREATE POLICY "anon_del_properties" ON properties FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_rooms" ON rooms;
CREATE POLICY "anon_all_rooms" ON rooms FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_rooms" ON rooms;
CREATE POLICY "anon_ins_rooms" ON rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_rooms" ON rooms;
CREATE POLICY "anon_upd_rooms" ON rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_rooms" ON rooms;
CREATE POLICY "anon_del_rooms" ON rooms FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_photos" ON photos;
CREATE POLICY "anon_all_photos" ON photos FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_photos" ON photos;
CREATE POLICY "anon_ins_photos" ON photos FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_photos" ON photos;
CREATE POLICY "anon_upd_photos" ON photos FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_photos" ON photos;
CREATE POLICY "anon_del_photos" ON photos FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_checklist" ON checklist_items;
CREATE POLICY "anon_all_checklist" ON checklist_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_checklist" ON checklist_items;
CREATE POLICY "anon_ins_checklist" ON checklist_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_checklist" ON checklist_items;
CREATE POLICY "anon_upd_checklist" ON checklist_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_checklist" ON checklist_items;
CREATE POLICY "anon_del_checklist" ON checklist_items FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_maintenance" ON maintenance_issues;
CREATE POLICY "anon_all_maintenance" ON maintenance_issues FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_maintenance" ON maintenance_issues;
CREATE POLICY "anon_ins_maintenance" ON maintenance_issues FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_maintenance" ON maintenance_issues;
CREATE POLICY "anon_upd_maintenance" ON maintenance_issues FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_maintenance" ON maintenance_issues;
CREATE POLICY "anon_del_maintenance" ON maintenance_issues FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_maint_updates" ON maintenance_updates;
CREATE POLICY "anon_all_maint_updates" ON maintenance_updates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_maint_updates" ON maintenance_updates;
CREATE POLICY "anon_ins_maint_updates" ON maintenance_updates FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_maint_updates" ON maintenance_updates;
CREATE POLICY "anon_del_maint_updates" ON maintenance_updates FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_all_settings" ON app_settings;
CREATE POLICY "anon_all_settings" ON app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_ins_settings" ON app_settings;
CREATE POLICY "anon_ins_settings" ON app_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_upd_settings" ON app_settings;
CREATE POLICY "anon_upd_settings" ON app_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_del_settings" ON app_settings;
CREATE POLICY "anon_del_settings" ON app_settings FOR DELETE TO anon, authenticated USING (true);

INSERT INTO app_settings (key, value) VALUES
  ('ai_backend_url', ''),
  ('ai_model', 'llava:7b'),
  ('ai_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
