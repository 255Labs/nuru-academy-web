-- ============================================================================
-- Migration 000: Safe function drop
-- Run this FIRST on every re-deploy to allow CREATE OR REPLACE to change
-- function signatures. Tables and data are NOT affected.
-- ============================================================================
DO $drop_all_functions$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT proname, pg_get_function_identity_arguments(oid) AS args
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
  LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname)
              || '(' || r.args || ') CASCADE;';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END
$drop_all_functions$;
