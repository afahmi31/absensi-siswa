CREATE TABLE public.school_logo_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE RESTRICT,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 2097152),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 4096),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid NOT NULL REFERENCES public.teacher_accounts(id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (school_id, id)
);

ALTER TABLE public.schools
  ADD COLUMN active_logo_asset_id uuid,
  ADD CONSTRAINT schools_active_logo_asset_owner_fk
    FOREIGN KEY (id, active_logo_asset_id)
    REFERENCES public.school_logo_assets(school_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.semester_archive_snapshots
  ADD COLUMN logo_asset_id uuid REFERENCES public.school_logo_assets(id) ON DELETE RESTRICT;

CREATE FUNCTION public.guard_school_logo_asset_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'school logo asset metadata is immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER school_logo_assets_immutable
  BEFORE UPDATE OR DELETE ON public.school_logo_assets
  FOR EACH ROW EXECUTE FUNCTION public.guard_school_logo_asset_immutable();

CREATE TRIGGER school_logo_assets_audit
  AFTER INSERT ON public.school_logo_assets
  FOR EACH ROW EXECUTE FUNCTION public.append_row_audit_event();

CREATE FUNCTION public.guard_semester_archive_logo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school_id uuid;
  v_active_logo_asset_id uuid;
BEGIN
  SELECT semester.school_id, school.active_logo_asset_id
    INTO v_school_id, v_active_logo_asset_id
  FROM public.semesters AS semester
  JOIN public.schools AS school ON school.id = semester.school_id
  WHERE semester.id = NEW.semester_id
  FOR SHARE OF school;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'semester archive school was not found' USING ERRCODE = '23503';
  END IF;

  IF NEW.logo_asset_id IS DISTINCT FROM v_active_logo_asset_id
     OR (NEW.logo_asset_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.school_logo_assets AS asset
       WHERE asset.id = NEW.logo_asset_id AND asset.school_id = v_school_id
     )) THEN
    RAISE EXCEPTION 'semester archive logo must match its school' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER semester_archive_snapshots_logo_guard
  BEFORE INSERT ON public.semester_archive_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.guard_semester_archive_logo();

CREATE OR REPLACE FUNCTION public.capture_semester_archive_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school_name text;
  v_class_name text;
  v_logo_asset_id uuid;
BEGIN
  IF OLD.status <> 'active' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT school.name, school_class.name, school.active_logo_asset_id
    INTO v_school_name, v_class_name, v_logo_asset_id
  FROM public.schools AS school
  JOIN public.school_classes AS school_class ON school_class.school_id = school.id
  WHERE school.id = NEW.school_id
  FOR SHARE OF school, school_class;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school and class details are required to archive a semester' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.semester_archive_snapshots (
    semester_id, school_name, class_name, academic_year, term, starts_on, ends_on, logo_asset_id
  ) VALUES (
    NEW.id, v_school_name, v_class_name, NEW.academic_year, NEW.term, NEW.starts_on, NEW.ends_on, v_logo_asset_id
  );

  RETURN NEW;
END
$$;

ALTER TABLE public.school_logo_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_logo_assets_select ON public.school_logo_assets
  FOR SELECT TO lab002_app USING (true);
CREATE POLICY school_logo_assets_insert ON public.school_logo_assets
  FOR INSERT TO lab002_app WITH CHECK (true);

REVOKE ALL PRIVILEGES ON TABLE public.school_logo_assets FROM PUBLIC;
DO $migration$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF to_regrole(api_role) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.school_logo_assets FROM %I', api_role);
    END IF;
  END LOOP;
END
$migration$;
REVOKE ALL PRIVILEGES ON TABLE public.school_logo_assets FROM lab002_app;
GRANT SELECT, INSERT ON TABLE public.school_logo_assets TO lab002_app;
