-- Resolve application tables from the trusted schema, including when a caller
-- changes its search_path or creates a temporary table with the same name.
DO $$
DECLARE
    application_function regprocedure;
BEGIN
    FOR application_function IN
        SELECT p.oid::regprocedure
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.proowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.classid = 'pg_proc'::regclass
                AND d.objid = p.oid AND d.deptype = 'e'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, public, pg_temp', application_function);
    END LOOP;
END $$;

-- Moving an extension preserves its dependent indexes and their data.
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
        WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
    ) THEN
        ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    END IF;
END $$;
