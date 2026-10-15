DROP TRIGGER IF EXISTS semester_archive_snapshots_logo_guard ON public.semester_archive_snapshots;
DROP TRIGGER IF EXISTS school_logo_assets_audit ON public.school_logo_assets;
DROP TRIGGER IF EXISTS school_logo_assets_immutable ON public.school_logo_assets;
DROP FUNCTION IF EXISTS public.guard_semester_archive_logo();
DROP FUNCTION IF EXISTS public.guard_school_logo_asset_immutable();

CREATE OR REPLACE FUNCTION public.capture_semester_archive_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_school_name text;
  v_class_name text;
BEGIN
  IF OLD.status <> 'active' OR NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;

  SELECT school.name, school_class.name
    INTO v_school_name, v_class_name
  FROM public.schools AS school
  JOIN public.school_classes AS school_class ON school_class.school_id = school.id
  WHERE school.id = NEW.school_id
  FOR SHARE OF school, school_class;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'school and class details are required to archive a semester' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.semester_archive_snapshots (
    semester_id, school_name, class_name, academic_year, term, starts_on, ends_on
  ) VALUES (
    NEW.id, v_school_name, v_class_name, NEW.academic_year, NEW.term, NEW.starts_on, NEW.ends_on
  );

  RETURN NEW;
END
$$;

ALTER TABLE public.semester_archive_snapshots DROP COLUMN logo_asset_id;
ALTER TABLE public.schools DROP CONSTRAINT schools_active_logo_asset_owner_fk;
ALTER TABLE public.schools DROP COLUMN active_logo_asset_id;
DROP TABLE public.school_logo_assets;
