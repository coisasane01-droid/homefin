-- Consultas somente leitura para pre-validar as migracoes do HomeFin.
-- Execute cada SELECT separadamente no Supabase SQL Editor.

WITH expected_tables(table_name, migration_stage) AS (
    VALUES
        ('homefin_saas', 'schema-base'),
        ('homefin_data', 'schema-base'),
        ('homefin_family_credentials', 'migracao-autenticacao-familiar'),
        ('homefin_auth_attempts', 'migracao-autenticacao-familiar'),
        ('homefin_spreadsheets', 'migracao-planilhas'),
        ('homefin_payments', 'migracao-pagamentos-segura'),
        ('homefin_support_messages', 'migracao-hardening-autenticacao-push'),
        ('homefin_support_settings', 'migracao-hardening-autenticacao-push'),
        ('homefin_push_subscriptions', 'migracao-hardening-autenticacao-push'),
        ('homefin_storage_cleanup_queue', 'migracao-hardening-autenticacao-push')
)
SELECT
    expected_tables.table_name,
    expected_tables.migration_stage,
    to_regclass(format('public.%I', expected_tables.table_name)) IS NOT NULL AS object_exists
FROM expected_tables
ORDER BY expected_tables.migration_stage, expected_tables.table_name;

WITH expected_columns(table_name, column_name, expected_type, used_by) AS (
    VALUES
        ('homefin_saas', 'id', 'text', 'APIs SaaS e RPCs'),
        ('homefin_saas', 'data', 'jsonb', 'APIs SaaS e RPCs'),
        ('homefin_data', 'family_id', 'text', 'API financeira'),
        ('homefin_data', 'data', 'jsonb', 'API financeira e anexos'),
        ('homefin_family_credentials', 'family_id', 'text', 'Autenticacao familiar'),
        ('homefin_family_credentials', 'pin_salt', 'text', 'Login'),
        ('homefin_family_credentials', 'pin_hash', 'text', 'Login'),
        ('homefin_family_credentials', 'recovery_salt', 'text', 'Recuperacao de PIN'),
        ('homefin_family_credentials', 'recovery_hash', 'text', 'Recuperacao de PIN'),
        ('homefin_family_credentials', 'session_version', 'int4', 'Validacao de sessao'),
        ('homefin_family_credentials', 'updated_at', 'timestamptz', 'Atualizacao de credencial'),
        ('homefin_auth_attempts', 'family_id', 'text', 'Rate limit'),
        ('homefin_auth_attempts', 'attempted_at', 'timestamptz', 'Rate limit'),
        ('homefin_auth_attempts', 'ip_hash', 'text', 'Rate limit por IP'),
        ('homefin_spreadsheets', 'id', 'uuid', 'API de planilhas'),
        ('homefin_spreadsheets', 'family_id', 'text', 'Isolamento de planilhas'),
        ('homefin_spreadsheets', 'name', 'text', 'API de planilhas'),
        ('homefin_spreadsheets', 'reference_month', 'int4', 'API de planilhas'),
        ('homefin_spreadsheets', 'reference_year', 'int4', 'API de planilhas'),
        ('homefin_spreadsheets', 'columns', 'jsonb', 'API de planilhas'),
        ('homefin_spreadsheets', 'rows', 'jsonb', 'API de planilhas'),
        ('homefin_spreadsheets', 'notes', 'text', 'API de planilhas'),
        ('homefin_spreadsheets', 'created_at', 'timestamptz', 'API de planilhas'),
        ('homefin_spreadsheets', 'updated_at', 'timestamptz', 'API de planilhas'),
        ('homefin_payments', 'payment_id', 'text', 'RPC de ativacao de plano'),
        ('homefin_payments', 'family_id', 'text', 'Exclusao familiar'),
        ('homefin_payments', 'plan_id', 'text', 'RPC de ativacao de plano'),
        ('homefin_payments', 'amount', 'numeric', 'RPC de ativacao de plano'),
        ('homefin_payments', 'currency', 'text', 'RPC de ativacao de plano'),
        ('homefin_payments', 'status', 'text', 'Registro de pagamento'),
        ('homefin_payments', 'created_at', 'timestamptz', 'Registro de pagamento'),
        ('homefin_payments', 'activated_at', 'timestamptz', 'RPC de ativacao de plano'),
        ('homefin_support_messages', 'id', 'uuid', 'API de suporte'),
        ('homefin_support_messages', 'family_id', 'text', 'Isolamento de suporte'),
        ('homefin_support_messages', 'sender_type', 'text', 'Perfil de suporte'),
        ('homefin_support_messages', 'message', 'text', 'API de suporte'),
        ('homefin_support_messages', 'read_at', 'timestamptz', 'API de suporte'),
        ('homefin_support_messages', 'created_at', 'timestamptz', 'API de suporte'),
        ('homefin_support_settings', 'family_id', 'text', 'Isolamento de suporte'),
        ('homefin_support_settings', 'blocked', 'bool', 'Configuracao de suporte'),
        ('homefin_support_settings', 'resolved', 'bool', 'Configuracao de suporte'),
        ('homefin_support_settings', 'resolved_at', 'timestamptz', 'Configuracao de suporte'),
        ('homefin_support_settings', 'updated_at', 'timestamptz', 'Configuracao de suporte'),
        ('homefin_push_subscriptions', 'id', 'uuid', 'API Push'),
        ('homefin_push_subscriptions', 'family_id', 'text', 'Isolamento familiar e perfil admin'),
        ('homefin_push_subscriptions', 'user_type', 'text', 'Separacao de perfis Push'),
        ('homefin_push_subscriptions', 'endpoint', 'text', 'Inscricao Push'),
        ('homefin_push_subscriptions', 'subscription', 'jsonb', 'Envio Push'),
        ('homefin_push_subscriptions', 'created_at', 'timestamptz', 'Inscricao Push'),
        ('homefin_push_subscriptions', 'updated_at', 'timestamptz', 'Inscricao Push'),
        ('homefin_storage_cleanup_queue', 'id', 'uuid', 'Limpeza de Storage'),
        ('homefin_storage_cleanup_queue', 'family_id', 'text', 'Isolamento da limpeza'),
        ('homefin_storage_cleanup_queue', 'object_paths', 'jsonb', 'Limpeza de Storage'),
        ('homefin_storage_cleanup_queue', 'created_at', 'timestamptz', 'Limpeza de Storage')
)
SELECT
    expected_columns.table_name,
    expected_columns.column_name,
    expected_columns.expected_type,
    col.udt_name AS actual_type,
    expected_columns.used_by,
    CASE
        WHEN col.column_name IS NULL THEN 'MISSING'
        WHEN col.udt_name <> expected_columns.expected_type THEN 'TYPE_MISMATCH'
        ELSE 'OK'
    END AS status
FROM expected_columns
LEFT JOIN information_schema.columns AS col
    ON col.table_schema = 'public'
   AND col.table_name = expected_columns.table_name
   AND col.column_name = expected_columns.column_name
ORDER BY expected_columns.table_name, expected_columns.column_name;

WITH expected_indexes(table_name, index_name) AS (
    VALUES
        ('homefin_auth_attempts', 'homefin_auth_attempts_family_time_idx'),
        ('homefin_auth_attempts', 'homefin_auth_attempts_ip_time_idx'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_family_id_idx'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_reference_year_idx'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_reference_month_idx'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_family_period_idx'),
        ('homefin_payments', 'homefin_payments_family_created_idx'),
        ('homefin_support_messages', 'homefin_support_messages_family_time_idx'),
        ('homefin_push_subscriptions', 'homefin_push_subscriptions_identity_idx'),
        ('homefin_storage_cleanup_queue', 'homefin_storage_cleanup_queue_created_idx')
)
SELECT
    expected_indexes.table_name,
    expected_indexes.index_name,
    pg_indexes.indexdef,
    (pg_indexes.indexname IS NOT NULL) AS index_exists
FROM expected_indexes
LEFT JOIN pg_indexes
    ON pg_indexes.schemaname = 'public'
   AND pg_indexes.tablename = expected_indexes.table_name
   AND pg_indexes.indexname = expected_indexes.index_name
ORDER BY expected_indexes.table_name, expected_indexes.index_name;

SELECT
    expected.signature,
    p.oid IS NOT NULL AS function_exists,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE pg_get_function_identity_arguments(p.oid)
    END AS actual_arguments,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE pg_get_function_result(p.oid)
    END AS return_type,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE p.prosecdef
    END AS security_definer,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE has_function_privilege('anon', p.oid, 'EXECUTE')
    END AS anon_can_execute,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE')
    END AS authenticated_can_execute,
    CASE WHEN p.oid IS NULL
         THEN NULL
         ELSE has_function_privilege('service_role', p.oid, 'EXECUTE')
    END AS service_role_can_execute
FROM (
    VALUES
        ('public.homefin_create_family_with_credentials(jsonb,text,text,text,text)'),
        ('public.homefin_create_family_with_credentials(jsonb,text,text)'),
        ('public.homefin_register_auth_failure(text,text)'),
        ('public.homefin_register_auth_failure(text)'),
        ('public.homefin_activate_paid_plan(text,text,text,numeric,text)'),
        ('public.homefin_delete_family(text)')
) AS expected(signature)
LEFT JOIN pg_proc AS p ON p.oid = to_regprocedure(expected.signature)::oid
ORDER BY expected.signature;

SELECT
    namespace.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    p.prosecdef AS security_definer,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS namespace ON namespace.oid = p.pronamespace
WHERE namespace.nspname = 'public'
  AND p.proname LIKE 'homefin\_%' ESCAPE '\'
ORDER BY p.proname, arguments;

SELECT
    expected.table_name,
    to_regclass(format('public.%I', expected.table_name)) IS NOT NULL AS table_exists,
    COALESCE(class.relrowsecurity, false) AS rls_enabled,
    COALESCE(class.relforcerowsecurity, false) AS force_rls
FROM (
    VALUES
        ('homefin_saas'),
        ('homefin_data'),
        ('homefin_family_credentials'),
        ('homefin_auth_attempts'),
        ('homefin_spreadsheets'),
        ('homefin_payments'),
        ('homefin_support_messages'),
        ('homefin_support_settings'),
        ('homefin_push_subscriptions'),
        ('homefin_storage_cleanup_queue')
) AS expected(table_name)
LEFT JOIN pg_class AS class
    ON class.oid = to_regclass(format('public.%I', expected.table_name))
ORDER BY expected.table_name;

SELECT
    table_name,
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
      'homefin_saas',
      'homefin_data',
      'homefin_family_credentials',
      'homefin_auth_attempts',
      'homefin_spreadsheets',
      'homefin_payments',
      'homefin_support_messages',
      'homefin_support_settings',
      'homefin_push_subscriptions',
      'homefin_storage_cleanup_queue'
  )
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

SELECT
    policy.schemaname,
    policy.tablename,
    policy.policyname,
    policy.permissive,
    policy.roles,
    policy.cmd,
    policy.qual,
    policy.with_check
FROM pg_policies AS policy
WHERE (policy.schemaname = 'public'
       AND policy.tablename IN (
           'homefin_saas',
           'homefin_data',
           'homefin_family_credentials',
           'homefin_auth_attempts',
           'homefin_spreadsheets',
           'homefin_payments',
           'homefin_support_messages',
           'homefin_support_settings',
           'homefin_push_subscriptions',
           'homefin_storage_cleanup_queue'
       ))
   OR (policy.schemaname = 'storage' AND policy.tablename = 'objects')
ORDER BY policy.schemaname, policy.tablename, policy.policyname;

SELECT
    to_regclass('public.homefin_saas') IS NOT NULL AS homefin_saas_exists,
    to_regclass('public.homefin_family_credentials') IS NOT NULL AS credentials_table_exists,
    to_regclass('public.homefin_data') IS NOT NULL AS financial_table_exists;

SELECT
    family.value->>'id' AS family_id,
    (credentials.family_id IS NOT NULL) AS has_server_credential,
    (credentials.family_id IS NOT NULL AND credentials.recovery_hash IS NULL) AS needs_recovery_setup,
    (financial.family_id IS NOT NULL) AS has_financial_data
FROM public.homefin_saas AS saas
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(saas.data->'families') = 'array'
            THEN saas.data->'families'
        ELSE '[]'::jsonb
    END
) AS family(value)
LEFT JOIN public.homefin_family_credentials AS credentials
    ON credentials.family_id = family.value->>'id'
LEFT JOIN public.homefin_data AS financial
    ON financial.family_id = family.value->>'id'
WHERE saas.id = 'global'
ORDER BY family.value->>'id';

SELECT
    count(DISTINCT family.value->>'id') AS total_families,
    count(DISTINCT family.value->>'id') FILTER (
        WHERE credentials.family_id IS NOT NULL
    ) AS families_with_server_credentials,
    count(DISTINCT family.value->>'id') FILTER (
        WHERE credentials.family_id IS NULL
    ) AS families_without_server_credentials,
    count(DISTINCT family.value->>'id') FILTER (
        WHERE credentials.family_id IS NOT NULL
          AND credentials.recovery_hash IS NULL
    ) AS families_without_server_recovery,
    count(DISTINCT family.value->>'id') FILTER (
        WHERE financial.family_id IS NOT NULL
    ) AS families_with_financial_data
FROM public.homefin_saas AS saas
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(saas.data->'families') = 'array'
            THEN saas.data->'families'
        ELSE '[]'::jsonb
    END
) AS family(value)
LEFT JOIN public.homefin_family_credentials AS credentials
    ON credentials.family_id = family.value->>'id'
LEFT JOIN public.homefin_data AS financial
    ON financial.family_id = family.value->>'id'
WHERE saas.id = 'global';

SELECT
    family.value->>'id' AS family_id
FROM public.homefin_saas AS saas
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(saas.data->'families') = 'array'
            THEN saas.data->'families'
        ELSE '[]'::jsonb
    END
) AS family(value)
LEFT JOIN public.homefin_family_credentials AS credentials
    ON credentials.family_id = family.value->>'id'
WHERE saas.id = 'global'
  AND credentials.family_id IS NULL
ORDER BY family.value->>'id';

SELECT
    family.value->>'id' AS family_id
FROM public.homefin_saas AS saas
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(saas.data->'families') = 'array'
            THEN saas.data->'families'
        ELSE '[]'::jsonb
    END
) AS family(value)
JOIN public.homefin_family_credentials AS credentials
    ON credentials.family_id = family.value->>'id'
WHERE saas.id = 'global'
  AND credentials.recovery_hash IS NULL
ORDER BY family.value->>'id';

SELECT
    financial.family_id,
    count(DISTINCT bill.ordinality) AS financial_records,
    count(attachment.ordinality) AS attachment_records,
    count(attachment.ordinality) FILTER (
        WHERE attachment.value->>'storagePath' IS NOT NULL
           OR attachment.value->>'url' LIKE '%/storage/v1/object/%'
    ) AS storage_references
FROM public.homefin_data AS financial
LEFT JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(financial.data->'bills') = 'array'
            THEN financial.data->'bills'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS bill(value, ordinality) ON true
LEFT JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(bill.value->'attachments') = 'array'
            THEN bill.value->'attachments'
        ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS attachment(value, ordinality) ON true
GROUP BY financial.family_id
ORDER BY financial.family_id;

SELECT
    family_id,
    count(*) AS spreadsheet_count
FROM public.homefin_spreadsheets
GROUP BY family_id
ORDER BY family_id;

SELECT
    family_id,
    count(*) AS payment_count
FROM public.homefin_payments
GROUP BY family_id
ORDER BY family_id;

SELECT
    to_regclass('storage.buckets') IS NOT NULL AS storage_buckets_table_exists,
    to_regclass('storage.objects') IS NOT NULL AS storage_objects_table_exists;

SELECT
    id AS bucket_id,
    public AS is_public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
WHERE id = 'attachments';

SELECT
    bucket_id,
    count(*) AS stored_object_count
FROM storage.objects
WHERE bucket_id = 'attachments'
GROUP BY bucket_id;

SELECT
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'storage'
  AND table_name = 'objects'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY grantee, privilege_type;

SELECT
    r.rolname,
    r.rolcanlogin,
    r.rolsuper
FROM pg_roles AS r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY r.rolname;
