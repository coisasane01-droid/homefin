-- Diagnostico somente leitura para a migracao de provisionamento familiar.
-- Execute manualmente no SQL Editor do Supabase. Este arquivo nao aplica mudancas.

-- 1) Lista todas as overloads da RPC, com os nomes/tipos dos argumentos,
--    SECURITY DEFINER, search_path, proprietario e permissao de service_role.
SELECT
    p.oid::regprocedure AS function_signature,
    p.proargnames AS argument_names,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    p.prosecdef AS security_definer,
    p.proconfig AS function_settings,
    pg_catalog.pg_get_userbyid(p.proowner) AS function_owner,
    pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
        AS service_role_can_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'homefin_issue_family_enrollment_authorization'
ORDER BY p.oid::regprocedure::text;

-- 2) Confirma explicitamente a assinatura de oito argumentos esperada pela API.
SELECT
    pg_catalog.to_regprocedure(
        'public.homefin_issue_family_enrollment_authorization(text,text,timestamp with time zone,text,boolean,text,text,text)'
    ) IS NOT NULL AS expected_eight_argument_signature_exists,
    CASE
        WHEN pg_catalog.to_regprocedure(
            'public.homefin_issue_family_enrollment_authorization(text,text,timestamp with time zone,text,boolean,text,text,text)'
        ) IS NOT NULL
        THEN pg_catalog.has_function_privilege(
            'service_role',
            pg_catalog.to_regprocedure(
                'public.homefin_issue_family_enrollment_authorization(text,text,timestamp with time zone,text,boolean,text,text,text)'
            ),
            'EXECUTE'
        )
        ELSE false
    END AS service_role_can_execute_expected_signature;

-- 3) Confirma tabelas e colunas usadas pela RPC de emissao e pela RPC de consumo.
WITH expected_columns(table_name, column_name, data_type) AS (
    VALUES
        ('homefin_saas', 'id', 'text'),
        ('homefin_saas', 'data', 'jsonb'),
        ('homefin_family_credentials', 'family_id', 'text'),
        ('homefin_family_credentials', 'session_version', 'integer'),
        ('homefin_family_enrollment_authorizations', 'family_id', 'text'),
        ('homefin_family_enrollment_authorizations', 'authorization_hash', 'text'),
        ('homefin_family_enrollment_authorizations', 'verification_method', 'text'),
        ('homefin_family_enrollment_authorizations', 'verified_by', 'text'),
        ('homefin_family_enrollment_authorizations', 'ownership_verified', 'boolean'),
        ('homefin_family_enrollment_authorizations', 'purpose', 'text'),
        ('homefin_family_enrollment_authorizations', 'expires_at', 'timestamp with time zone'),
        ('homefin_family_enrollment_authorizations', 'consumed_at', 'timestamp with time zone'),
        ('homefin_family_enrollment_authorizations', 'revoked_at', 'timestamp with time zone'),
        ('homefin_family_enrollment_audit', 'family_id', 'text'),
        ('homefin_family_enrollment_audit', 'event_type', 'text'),
        ('homefin_family_enrollment_audit', 'actor_label', 'text'),
        ('homefin_family_enrollment_audit', 'verification_method', 'text'),
        ('homefin_family_enrollment_audit', 'ip_hash', 'text'),
        ('homefin_family_enrollment_audit', 'ownership_verified', 'boolean'),
        ('homefin_family_enrollment_audit', 'purpose', 'text'),
        ('homefin_family_enrollment_attempts', 'family_id', 'text'),
        ('homefin_family_enrollment_attempts', 'ip_hash', 'text'),
        ('homefin_family_enrollment_attempts', 'attempted_at', 'timestamp with time zone')
)
SELECT
    expected.table_name,
    expected.column_name,
    expected.data_type AS expected_data_type,
    existing.data_type AS actual_data_type,
    existing.column_name IS NOT NULL
        AND existing.data_type = expected.data_type AS matches
FROM expected_columns AS expected
LEFT JOIN information_schema.columns AS existing
  ON existing.table_schema = 'public'
 AND existing.table_name = expected.table_name
 AND existing.column_name = expected.column_name
ORDER BY expected.table_name, expected.column_name;

-- 4) Confirma RLS nas tabelas sensiveis e grants necessarios para service_role.
SELECT
    table_name,
    row_security_enabled,
    service_role_can_select,
    service_role_can_insert,
    service_role_can_update,
    service_role_can_delete
FROM (
    SELECT
        c.relname AS table_name,
        c.relrowsecurity AS row_security_enabled,
        pg_catalog.has_table_privilege('service_role', c.oid, 'SELECT')
            AS service_role_can_select,
        pg_catalog.has_table_privilege('service_role', c.oid, 'INSERT')
            AS service_role_can_insert,
        pg_catalog.has_table_privilege('service_role', c.oid, 'UPDATE')
            AS service_role_can_update,
        pg_catalog.has_table_privilege('service_role', c.oid, 'DELETE')
            AS service_role_can_delete
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n
      ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
          'homefin_family_credentials',
          'homefin_family_enrollment_authorizations',
          'homefin_family_enrollment_attempts',
          'homefin_family_enrollment_audit'
      )
) AS table_permissions
ORDER BY table_name;

-- 5) Confirma os indices de uso unico/consulta criados pela migracao.
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'homefin_family_enrollment_authorizations',
      'homefin_family_enrollment_attempts'
  )
ORDER BY tablename, indexname;
