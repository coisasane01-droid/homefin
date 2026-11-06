-- Preflight consolidado do HomeFin: uma consulta, somente leitura.
-- Retorna uma linha por verificacao; nao lista valores de PIN, hashes, tokens ou senhas.
-- Use no SQL Editor de um projeto Supabase autorizado a consultar o catalogo.
WITH
expected_tables(table_name, category, migration_stage) AS (
    VALUES
        ('homefin_saas', 'Estrutura das tabelas', 'schema-base'),
        ('homefin_data', 'Estrutura das tabelas', 'schema-base'),
        ('homefin_family_credentials', 'Credenciais server-side', 'migracao-autenticacao-familiar'),
        ('homefin_auth_attempts', 'Credenciais server-side', 'migracao-autenticacao-familiar'),
        ('homefin_spreadsheets', 'Planilhas e pagamentos', 'migracao-planilhas'),
        ('homefin_payments', 'Planilhas e pagamentos', 'migracao-pagamentos-segura'),
        ('homefin_support_messages', 'Notificações e suporte', 'migracao-hardening-autenticacao-push'),
        ('homefin_support_settings', 'Notificações e suporte', 'migracao-hardening-autenticacao-push'),
        ('homefin_push_subscriptions', 'Notificações e suporte', 'migracao-hardening-autenticacao-push'),
        ('homefin_storage_cleanup_queue', 'Storage e bucket attachments', 'migracao-hardening-autenticacao-push')
),
expected_columns(table_name, column_name, expected_type, category) AS (
    VALUES
        ('homefin_saas', 'id', 'text', 'Estrutura das tabelas'),
        ('homefin_saas', 'data', 'jsonb', 'Estrutura das tabelas'),
        ('homefin_saas', 'updated_at', 'timestamptz', 'Estrutura das tabelas'),
        ('homefin_data', 'family_id', 'text', 'Estrutura das tabelas'),
        ('homefin_data', 'data', 'jsonb', 'Estrutura das tabelas'),
        ('homefin_family_credentials', 'family_id', 'text', 'Credenciais server-side'),
        ('homefin_family_credentials', 'pin_salt', 'text', 'Credenciais server-side'),
        ('homefin_family_credentials', 'pin_hash', 'text', 'Credenciais server-side'),
        ('homefin_family_credentials', 'recovery_salt', 'text', 'Recuperação de PIN'),
        ('homefin_family_credentials', 'recovery_hash', 'text', 'Recuperação de PIN'),
        ('homefin_family_credentials', 'session_version', 'int4', 'Credenciais server-side'),
        ('homefin_family_credentials', 'updated_at', 'timestamptz', 'Credenciais server-side'),
        ('homefin_auth_attempts', 'family_id', 'text', 'Credenciais server-side'),
        ('homefin_auth_attempts', 'attempted_at', 'timestamptz', 'Credenciais server-side'),
        ('homefin_auth_attempts', 'ip_hash', 'text', 'Credenciais server-side'),
        ('homefin_spreadsheets', 'id', 'uuid', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'family_id', 'text', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'name', 'text', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'reference_month', 'int4', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'reference_year', 'int4', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'columns', 'jsonb', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'rows', 'jsonb', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'notes', 'text', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'created_at', 'timestamptz', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'updated_at', 'timestamptz', 'Planilhas e pagamentos'),
        ('homefin_payments', 'payment_id', 'text', 'Planilhas e pagamentos'),
        ('homefin_payments', 'family_id', 'text', 'Planilhas e pagamentos'),
        ('homefin_payments', 'plan_id', 'text', 'Planilhas e pagamentos'),
        ('homefin_payments', 'amount', 'numeric', 'Planilhas e pagamentos'),
        ('homefin_payments', 'currency', 'text', 'Planilhas e pagamentos'),
        ('homefin_payments', 'status', 'text', 'Planilhas e pagamentos'),
        ('homefin_payments', 'created_at', 'timestamptz', 'Planilhas e pagamentos'),
        ('homefin_payments', 'activated_at', 'timestamptz', 'Planilhas e pagamentos'),
        ('homefin_support_messages', 'id', 'uuid', 'Notificações e suporte'),
        ('homefin_support_messages', 'family_id', 'text', 'Notificações e suporte'),
        ('homefin_support_messages', 'sender_type', 'text', 'Notificações e suporte'),
        ('homefin_support_messages', 'message', 'text', 'Notificações e suporte'),
        ('homefin_support_messages', 'read_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_support_messages', 'created_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_support_settings', 'family_id', 'text', 'Notificações e suporte'),
        ('homefin_support_settings', 'blocked', 'bool', 'Notificações e suporte'),
        ('homefin_support_settings', 'resolved', 'bool', 'Notificações e suporte'),
        ('homefin_support_settings', 'resolved_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_support_settings', 'updated_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'id', 'uuid', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'family_id', 'text', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'user_type', 'text', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'endpoint', 'text', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'subscription', 'jsonb', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'created_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'updated_at', 'timestamptz', 'Notificações e suporte'),
        ('homefin_storage_cleanup_queue', 'id', 'uuid', 'Storage e bucket attachments'),
        ('homefin_storage_cleanup_queue', 'family_id', 'text', 'Storage e bucket attachments'),
        ('homefin_storage_cleanup_queue', 'object_paths', 'jsonb', 'Storage e bucket attachments'),
        ('homefin_storage_cleanup_queue', 'created_at', 'timestamptz', 'Storage e bucket attachments')
),
expected_indexes(table_name, index_name, category) AS (
    VALUES
        ('homefin_auth_attempts', 'homefin_auth_attempts_family_time_idx', 'Credenciais server-side'),
        ('homefin_auth_attempts', 'homefin_auth_attempts_ip_time_idx', 'Credenciais server-side'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_family_id_idx', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_reference_year_idx', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_reference_month_idx', 'Planilhas e pagamentos'),
        ('homefin_spreadsheets', 'homefin_spreadsheets_family_period_idx', 'Planilhas e pagamentos'),
        ('homefin_payments', 'homefin_payments_family_created_idx', 'Planilhas e pagamentos'),
        ('homefin_support_messages', 'homefin_support_messages_family_time_idx', 'Notificações e suporte'),
        ('homefin_push_subscriptions', 'homefin_push_subscriptions_identity_idx', 'Notificações e suporte'),
        ('homefin_storage_cleanup_queue', 'homefin_storage_cleanup_queue_created_idx', 'Storage e bucket attachments')
),
expected_functions(signature, expected_result, expected_security_definer, category, required) AS (
    VALUES
        ('public.homefin_create_family_with_credentials(jsonb,text,text,text,text)', 'jsonb', true, 'Funções RPC', true),
        ('public.homefin_create_family_with_credentials(jsonb,text,text)', 'jsonb', true, 'Funções RPC', false),
        ('public.homefin_register_auth_failure(text,text)', 'boolean', true, 'Funções RPC', true),
        ('public.homefin_register_auth_failure(text)', 'boolean', true, 'Funções RPC', false),
        ('public.homefin_activate_paid_plan(text,text,text,numeric,text)', 'jsonb', true, 'Funções RPC', true),
        ('public.homefin_delete_family(text)', 'boolean', true, 'Funções RPC', true)
),
security_role_names AS (
    SELECT
        (SELECT rolname FROM pg_roles WHERE rolname = 'anon') AS anon_name,
        (SELECT rolname FROM pg_roles WHERE rolname = 'authenticated') AS authenticated_name,
        (SELECT rolname FROM pg_roles WHERE rolname = 'service_role') AS service_role_name
),
table_checks AS (
    SELECT
        t.category,
        'Tabela public.' || t.table_name AS check_name,
        CASE
            WHEN relation.oid IS NULL THEN 'ausente; etapa=' || t.migration_stage
            WHEN relation.relkind NOT IN ('r', 'p') THEN 'objeto presente com relkind=' || relation.relkind::text || '; etapa=' || t.migration_stage
            ELSE 'tabela presente; relkind=' || relation.relkind::text || '; etapa=' || t.migration_stage
        END AS found,
        CASE WHEN relation.oid IS NULL OR relation.relkind NOT IN ('r', 'p')
             THEN 'BLOQUEIO' ELSE 'OK' END AS situation,
        CASE WHEN relation.oid IS NULL THEN 'Tabela necessaria para a etapa indicada ainda nao existe.'
             WHEN relation.relkind NOT IN ('r', 'p') THEN 'O objeto existe, mas nao e tabela comum/particionada como esperado.'
        END AS problem
    FROM expected_tables AS t
    LEFT JOIN pg_class AS relation
        ON relation.oid = to_regclass(format('public.%I', t.table_name))
),
column_checks AS (
    SELECT
        c.category,
        'Coluna public.' || c.table_name || '.' || c.column_name AS check_name,
        CASE
            WHEN actual.attname IS NULL THEN 'ausente; tipo esperado=' || c.expected_type
            ELSE 'tipo encontrado=' || actual_type.typname::text || '; tipo esperado=' || c.expected_type
        END AS found,
        CASE
            WHEN actual.attname IS NULL OR actual_type.typname::text <> c.expected_type THEN 'BLOQUEIO'
            ELSE 'OK'
        END AS situation,
        CASE
            WHEN actual.attname IS NULL THEN 'Coluna ausente; confirme/aplique a migracao correspondente.'
            WHEN actual_type.typname::text <> c.expected_type THEN 'Tipo incompatível; requer análise antes de migrar.'
            ELSE NULL
        END AS problem
    FROM expected_columns AS c
    LEFT JOIN pg_class AS relation
        ON relation.oid = to_regclass(format('public.%I', c.table_name))
    LEFT JOIN pg_attribute AS actual
        ON actual.attrelid = relation.oid
       AND actual.attname::text = c.column_name
       AND actual.attnum > 0
       AND NOT actual.attisdropped
    LEFT JOIN pg_type AS actual_type ON actual_type.oid = actual.atttypid
),
index_checks AS (
    SELECT
        i.category,
        'Indice ' || i.index_name AS check_name,
        COALESCE(found.indexdef, 'ausente') AS found,
        'ATENÇÃO'::text AS situation,
        CASE WHEN found.indexname IS NULL
             THEN 'Indice esperado nao encontrado; avalie impacto de desempenho.'
             ELSE 'Indice com esse nome existe; confirme a definicao retornada contra a migracao.' END AS problem
    FROM expected_indexes AS i
    LEFT JOIN pg_indexes AS found
        ON found.schemaname = 'public'
       AND found.tablename = i.table_name
       AND found.indexname = i.index_name
),
rpc_checks AS (
    SELECT
        f.category,
        'RPC ' || f.signature AS check_name,
        CASE
            WHEN p.oid IS NULL THEN 'ausente'
            ELSE 'presente; argumentos=' || pg_get_function_identity_arguments(p.oid)
                || '; security_definer=' || p.prosecdef::text
                || '; retorno=' || pg_get_function_result(p.oid)
                || '; anon_execute=' || COALESCE(CASE WHEN roles.anon_name IS NULL THEN NULL ELSE has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')::text END, 'indisponivel')
                || '; authenticated_execute=' || COALESCE(CASE WHEN roles.authenticated_name IS NULL THEN NULL ELSE has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE')::text END, 'indisponivel')
                || '; service_role_execute=' || COALESCE(CASE WHEN roles.service_role_name IS NULL THEN NULL ELSE has_function_privilege(roles.service_role_name, p.oid, 'EXECUTE')::text END, 'indisponivel')
        END AS found,
        CASE
            WHEN p.oid IS NULL AND f.required THEN 'BLOQUEIO'
            WHEN p.oid IS NULL THEN 'OK'
            WHEN pg_get_function_result(p.oid) <> f.expected_result THEN 'BLOQUEIO'
            WHEN p.prosecdef <> f.expected_security_definer THEN 'BLOQUEIO'
            WHEN NOT f.required THEN 'ATENÇÃO'
            WHEN roles.service_role_name IS NULL THEN 'BLOQUEIO'
            WHEN roles.anon_name IS NULL OR roles.authenticated_name IS NULL THEN 'ATENÇÃO'
            WHEN has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')
              OR has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE')
              OR NOT has_function_privilege(roles.service_role_name, p.oid, 'EXECUTE') THEN 'BLOQUEIO'
            ELSE 'OK'
        END AS situation,
        CASE
            WHEN p.oid IS NULL AND f.required THEN 'RPC obrigatoria ausente.'
            WHEN p.oid IS NOT NULL AND pg_get_function_result(p.oid) <> f.expected_result
                THEN 'Tipo de retorno divergente da migracao.'
            WHEN p.oid IS NOT NULL AND p.prosecdef <> f.expected_security_definer
                THEN 'A propriedade SECURITY DEFINER diverge da migracao.'
            WHEN NOT f.required AND p.oid IS NOT NULL THEN 'Sobrecarga legada encontrada; confirme que nao esta exposta a clientes.'
            WHEN p.oid IS NOT NULL AND roles.service_role_name IS NULL THEN 'Papel service_role ausente; nao e possivel validar o uso server-side.'
            WHEN p.oid IS NOT NULL AND (roles.anon_name IS NULL OR roles.authenticated_name IS NULL)
                THEN 'Nao foi possivel validar todos os grants da RPC.'
            WHEN p.oid IS NOT NULL AND (
                has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')
                OR has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE')
                OR NOT has_function_privilege(roles.service_role_name, p.oid, 'EXECUTE')
            ) THEN 'Privilégios da RPC divergem do acesso esperado apenas pelo servidor.'
        END AS problem
    FROM expected_functions AS f
    LEFT JOIN pg_proc AS p ON p.oid = to_regprocedure(f.signature)::oid
    CROSS JOIN security_role_names AS roles
),
other_rpc_checks AS (
    SELECT
        'Funções RPC'::text AS category,
        'RPC adicional public.' || p.proname::text || '(' ||
            pg_get_function_identity_arguments(p.oid) || ')' AS check_name,
        'security_definer=' || p.prosecdef::text
            || '; anon_execute=' || COALESCE(CASE WHEN roles.anon_name IS NULL THEN NULL ELSE has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')::text END, 'indisponivel')
            || '; authenticated_execute=' || COALESCE(CASE WHEN roles.authenticated_name IS NULL THEN NULL ELSE has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE')::text END, 'indisponivel')
            || '; service_role_execute=' || COALESCE(CASE WHEN roles.service_role_name IS NULL THEN NULL ELSE has_function_privilege(roles.service_role_name, p.oid, 'EXECUTE')::text END, 'indisponivel') AS found,
        CASE
            WHEN roles.anon_name IS NULL OR roles.authenticated_name IS NULL THEN 'ATENÇÃO'
            WHEN roles.service_role_name IS NULL THEN 'ATENÇÃO'
            WHEN has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')
              OR has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE') THEN 'ATENÇÃO'
            ELSE 'OK'
        END AS situation,
        CASE
            WHEN roles.anon_name IS NULL OR roles.authenticated_name IS NULL
                THEN 'Nao foi possivel confirmar os grants efetivos desta RPC.'
            WHEN roles.service_role_name IS NULL THEN 'O papel service_role nao foi encontrado para validar a RPC.'
            WHEN has_function_privilege(roles.anon_name, p.oid, 'EXECUTE')
              OR has_function_privilege(roles.authenticated_name, p.oid, 'EXECUTE')
            THEN 'RPC HomeFin adicional executavel diretamente por cliente; revise a autorizacao.'
        END AS problem
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    CROSS JOIN security_role_names AS roles
    WHERE n.nspname = 'public'
      AND p.proname::text LIKE 'homefin\_%' ESCAPE '\'
      AND NOT EXISTS (
          SELECT 1
          FROM expected_functions AS f
          WHERE to_regprocedure(f.signature)::oid = p.oid
      )
),
rls_checks AS (
    SELECT
        'RLS e permissões'::text AS category,
        'RLS public.' || t.table_name AS check_name,
        CASE
            WHEN cls.oid IS NULL THEN 'tabela ausente'
            ELSE 'rls_enabled=' || cls.relrowsecurity::text || '; force_rls=' || cls.relforcerowsecurity::text
        END AS found,
        CASE WHEN cls.oid IS NULL OR NOT cls.relrowsecurity THEN 'BLOQUEIO' ELSE 'OK' END AS situation,
        CASE WHEN cls.oid IS NULL THEN 'Sem tabela para verificar RLS.'
             WHEN NOT cls.relrowsecurity THEN 'RLS nao esta habilitado.'
        END AS problem
    FROM expected_tables AS t
    LEFT JOIN pg_class AS cls ON cls.oid = to_regclass(format('public.%I', t.table_name))
),
grant_checks AS (
    SELECT
        'RLS e permissões'::text AS category,
        'Grants public.' || t.table_name AS check_name,
        CASE
            WHEN relation.oid IS NULL THEN 'tabela ausente'
            ELSE 'PUBLIC ACL=' || COALESCE(public_acl.privileges, 'nenhum')
                 || '; anon CRUD=' || COALESCE(client_access.anon_crud, 'indisponivel')
                 || '; authenticated CRUD=' || COALESCE(client_access.authenticated_crud, 'indisponivel')
                 || '; service_role CRUD=' || COALESCE(client_access.service_role_crud, 'indisponivel')
        END AS found,
        CASE
            WHEN relation.oid IS NULL THEN 'BLOQUEIO'
            WHEN service_role.rolname IS NULL THEN 'BLOQUEIO'
            WHEN client_roles.anon_name IS NULL OR client_roles.authenticated_name IS NULL THEN 'ATENÇÃO'
            WHEN client_access.anon_has_access OR client_access.authenticated_has_access THEN 'BLOQUEIO'
            WHEN client_access.service_role_has_all_crud IS NOT TRUE THEN 'BLOQUEIO'
            WHEN public_acl.has_public_access THEN 'BLOQUEIO'
            ELSE 'OK'
        END AS situation,
        CASE
            WHEN relation.oid IS NULL THEN 'Sem tabela para verificar grants.'
            WHEN service_role.rolname IS NULL THEN 'O papel service_role nao existe; as APIs nao podem confirmar o acesso ao banco.'
            WHEN client_roles.anon_name IS NULL OR client_roles.authenticated_name IS NULL
                THEN 'Nao foi possivel confirmar os grants efetivos de anon/authenticated.'
            WHEN client_access.anon_has_access OR client_access.authenticated_has_access
                THEN 'PUBLIC, anon ou authenticated possui acesso efetivo direto; bloqueie esse acesso antes do hardening.'
            WHEN client_access.service_role_has_all_crud IS NOT TRUE
                THEN 'Nao foi possivel confirmar SELECT, INSERT, UPDATE e DELETE para service_role.'
            WHEN public_acl.has_public_access
                THEN 'A ACL da tabela concede privilegios diretamente a PUBLIC.'
        END AS problem
    FROM expected_tables AS t
    LEFT JOIN pg_class AS relation
        ON relation.oid = to_regclass(format('public.%I', t.table_name))
    LEFT JOIN pg_roles AS service_role ON service_role.rolname = 'service_role'
    LEFT JOIN LATERAL (
        SELECT
            (SELECT role.rolname FROM pg_roles AS role WHERE role.rolname = 'anon') AS anon_name,
            (SELECT role.rolname FROM pg_roles AS role WHERE role.rolname = 'authenticated') AS authenticated_name
    ) AS client_roles ON true
    LEFT JOIN LATERAL (
        SELECT
            CASE WHEN client_roles.anon_name IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(client_roles.anon_name, relation.oid, 'SELECT')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'INSERT')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'UPDATE')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'DELETE')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'TRUNCATE')
            END AS anon_has_access,
            CASE WHEN client_roles.authenticated_name IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(client_roles.authenticated_name, relation.oid, 'SELECT')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'INSERT')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'UPDATE')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'DELETE')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'TRUNCATE')
            END AS authenticated_has_access,
            CASE WHEN service_role.rolname IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(service_role.rolname, relation.oid, 'SELECT')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'INSERT')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'UPDATE')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'DELETE')
            END AS service_role_has_all_crud,
            CASE WHEN client_roles.anon_name IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(client_roles.anon_name, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(client_roles.anon_name, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'DELETE')::text
                     || ',TRUNCATE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'TRUNCATE')::text
            END AS anon_crud,
            CASE WHEN client_roles.authenticated_name IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'DELETE')::text
                     || ',TRUNCATE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'TRUNCATE')::text
            END AS authenticated_crud,
            CASE WHEN service_role.rolname IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(service_role.rolname, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(service_role.rolname, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(service_role.rolname, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(service_role.rolname, relation.oid, 'DELETE')::text
            END AS service_role_crud
    ) AS client_access ON true
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(bool_or(acl.privilege_type IN
                ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), false) AS has_public_access,
            string_agg(acl.privilege_type, ',' ORDER BY acl.privilege_type) FILTER (
                WHERE acl.privilege_type IN
                    ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
            ) AS privileges
        FROM aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) AS acl
        WHERE acl.grantee = 0
    ) AS public_acl ON relation.oid IS NOT NULL
),
policy_checks AS (
    SELECT
        CASE WHEN p.schemaname = 'storage' THEN 'Storage e bucket attachments'
             WHEN p.tablename IN ('homefin_push_subscriptions', 'homefin_support_messages', 'homefin_support_settings')
                 THEN 'Notificações e suporte'
             ELSE 'RLS e permissões'
        END AS category,
        'Policies ' || p.schemaname || '.' || p.tablename AS check_name,
        string_agg(
            p.policyname::text || ': ' || p.cmd || '; permissive=' || p.permissive
                || '; roles=' || array_to_string(p.roles, ',')
                || '; using=' || COALESCE(p.qual, '')
                || '; with_check=' || COALESCE(p.with_check, ''),
            ' | ' ORDER BY p.policyname
        ) AS found,
        'ATENÇÃO'::text AS situation,
        'Revise a expressao e o escopo das policies; a consulta apenas inventaria a configuracao.'::text AS problem
    FROM pg_policies AS p
    WHERE (p.schemaname = 'public' AND p.tablename IN (
        'homefin_saas', 'homefin_data', 'homefin_family_credentials', 'homefin_auth_attempts',
        'homefin_spreadsheets', 'homefin_payments', 'homefin_support_messages',
        'homefin_support_settings', 'homefin_push_subscriptions', 'homefin_storage_cleanup_queue'
    ))
       OR (p.schemaname = 'storage' AND p.tablename = 'objects')
    GROUP BY p.schemaname, p.tablename
),
policy_absence_checks AS (
    SELECT
        CASE WHEN t.table_name IN ('homefin_push_subscriptions', 'homefin_support_messages', 'homefin_support_settings')
             THEN 'Notificações e suporte' ELSE 'RLS e permissões' END AS category,
        'Policies public.' || t.table_name AS check_name,
        CASE WHEN count(p.policyname) = 0 THEN 'nenhuma policy encontrada'
             ELSE count(p.policyname)::text || ' policy(s)' END AS found,
        'ATENÇÃO'::text AS situation,
        CASE WHEN count(p.policyname) = 0
             THEN 'Nenhuma policy encontrada; confirme se a ausencia e intencional.'
             ELSE 'Existencia nao confirma a expressao; revise os detalhes da policy listados.' END AS problem
    FROM expected_tables AS t
    LEFT JOIN pg_policies AS p ON p.schemaname = 'public' AND p.tablename = t.table_name
    GROUP BY t.table_name
),
storage_policy_check AS (
    SELECT
        'Storage e bucket attachments'::text AS category,
        'Policies storage.objects'::text AS check_name,
        CASE
            WHEN to_regclass('storage.objects') IS NULL THEN 'nao verificavel: storage.objects ausente'
            ELSE 'rls_enabled=' || COALESCE(storage_relation.relrowsecurity, false)::text
                 || '; policy=' || CASE WHEN count(p.policyname) FILTER (
                WHERE p.policyname = 'HomeFin deny direct attachments access'
                  AND p.permissive = 'RESTRICTIVE'
                  AND p.cmd = 'ALL'
                  AND p.roles @> ARRAY['anon'::name, 'authenticated'::name]
                  AND strpos(lower(COALESCE(p.qual, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.qual, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.qual, '')), 'attachments') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.with_check, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'attachments') > 0
            ) > 0 THEN 'confirmada'
                    ELSE 'ausente/incompativel' END
                 || '; detalhes=' || COALESCE(string_agg(
                p.policyname::text || ': ' || p.cmd || '; permissive=' || p.permissive
                    || '; roles=' || array_to_string(p.roles, ',')
                    || '; using=' || COALESCE(p.qual, '')
                    || '; with_check=' || COALESCE(p.with_check, ''),
                ' | ' ORDER BY p.policyname
            ), 'nenhuma policy')
        END AS found,
        CASE
            WHEN to_regclass('storage.objects') IS NULL THEN 'ATENÇÃO'
            WHEN NOT COALESCE(storage_relation.relrowsecurity, false) THEN 'BLOQUEIO'
            WHEN count(p.policyname) FILTER (
                WHERE p.policyname = 'HomeFin deny direct attachments access'
                  AND p.permissive = 'RESTRICTIVE'
                  AND p.cmd = 'ALL'
                  AND p.roles @> ARRAY['anon'::name, 'authenticated'::name]
                  AND strpos(lower(COALESCE(p.qual, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.qual, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.qual, '')), 'attachments') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.with_check, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'attachments') > 0
            ) > 0 THEN 'OK'
            ELSE 'BLOQUEIO'
        END AS situation,
        CASE WHEN to_regclass('storage.objects') IS NULL THEN 'Tabela de objetos do Storage indisponivel.'
             WHEN NOT COALESCE(storage_relation.relrowsecurity, false)
                THEN 'RLS de storage.objects esta desabilitado; as policies nao serao aplicadas.'
             WHEN count(p.policyname) FILTER (
                WHERE p.policyname = 'HomeFin deny direct attachments access'
                  AND p.permissive = 'RESTRICTIVE'
                  AND p.cmd = 'ALL'
                  AND p.roles @> ARRAY['anon'::name, 'authenticated'::name]
                  AND strpos(lower(COALESCE(p.qual, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.qual, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.qual, '')), 'attachments') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'bucket_id') > 0
                  AND strpos(COALESCE(p.with_check, ''), '<>') > 0
                  AND strpos(lower(COALESCE(p.with_check, '')), 'attachments') > 0
             ) = 0 THEN 'A policy restritiva esperada nao foi confirmada; nao remova grants globais para compensar.'
        END AS problem
    FROM (VALUES (1)) AS singleton(value)
    LEFT JOIN pg_class AS storage_relation ON storage_relation.oid = to_regclass('storage.objects')
    LEFT JOIN pg_policies AS p
        ON p.schemaname = 'storage'
       AND p.tablename = 'objects'
    GROUP BY storage_relation.relrowsecurity
),
family_capability AS (
    SELECT
        EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_saas' AND column_name='id' AND udt_name='text')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_saas' AND column_name='data' AND udt_name='jsonb')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_family_credentials' AND column_name='family_id' AND udt_name='text')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_family_credentials' AND column_name='recovery_hash')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_data' AND column_name='family_id' AND udt_name='text')
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_data' AND column_name='data' AND udt_name='jsonb')
        AND to_regclass('public.homefin_saas') IS NOT NULL
        AND to_regclass('public.homefin_family_credentials') IS NOT NULL
        AND to_regclass('public.homefin_data') IS NOT NULL
        AND CASE WHEN to_regclass('public.homefin_saas') IS NULL THEN false
                 ELSE has_table_privilege(current_user, to_regclass('public.homefin_saas'), 'SELECT') END
        AND CASE WHEN to_regclass('public.homefin_family_credentials') IS NULL THEN false
                 ELSE has_table_privilege(current_user, to_regclass('public.homefin_family_credentials'), 'SELECT') END
        AND CASE WHEN to_regclass('public.homefin_data') IS NULL THEN false
                 ELSE has_table_privilege(current_user, to_regclass('public.homefin_data'), 'SELECT') END AS can_query
),
family_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml($family$
        WITH families AS (
            SELECT DISTINCT item.value->>'id' AS family_id
            FROM public.homefin_saas AS saas
            CROSS JOIN LATERAL jsonb_array_elements(
                CASE WHEN jsonb_typeof(saas.data->'families') = 'array'
                     THEN saas.data->'families' ELSE '[]'::jsonb END
            ) AS item(value)
            WHERE saas.id = 'global'
        ),
        credential_summary AS (
            SELECT family_id, bool_or(recovery_hash IS NOT NULL) AS has_recovery
            FROM public.homefin_family_credentials
            GROUP BY family_id
        ),
        financial_summary AS (
            SELECT financial.family_id,
                   sum(line.financial_records) AS financial_records,
                   sum(line.attachment_records) AS attachment_records,
                   sum(line.storage_references) AS storage_references
            FROM public.homefin_data AS financial
            CROSS JOIN LATERAL (
                SELECT count(DISTINCT bill.ordinality) AS financial_records,
                       count(attachment.ordinality) AS attachment_records,
                       count(attachment.ordinality) FILTER (
                           WHERE attachment.value->>'storagePath' IS NOT NULL
                              OR attachment.value->>'url' LIKE '%/storage/v1/object/%'
                       ) AS storage_references
                FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(financial.data->'bills') = 'array'
                         THEN financial.data->'bills' ELSE '[]'::jsonb END
                ) WITH ORDINALITY AS bill(value, ordinality)
                LEFT JOIN LATERAL jsonb_array_elements(
                    CASE WHEN jsonb_typeof(bill.value->'attachments') = 'array'
                         THEN bill.value->'attachments' ELSE '[]'::jsonb END
                ) WITH ORDINALITY AS attachment(value, ordinality) ON true
            ) AS line
            GROUP BY financial.family_id
        )
        SELECT count(DISTINCT family.family_id) AS total_families,
               count(DISTINCT family.family_id) FILTER (WHERE credential.family_id IS NOT NULL) AS with_credentials,
               count(DISTINCT family.family_id) FILTER (WHERE credential.family_id IS NULL) AS without_credentials,
               count(DISTINCT family.family_id) FILTER (WHERE credential.family_id IS NOT NULL AND NOT credential.has_recovery) AS without_recovery,
               count(DISTINCT family.family_id) FILTER (WHERE financial.family_id IS NOT NULL) AS with_financial_data,
               COALESCE(string_agg(DISTINCT family.family_id, ', ' ORDER BY family.family_id)
                   FILTER (WHERE credential.family_id IS NULL), 'nenhuma') AS missing_credential_ids,
               COALESCE(string_agg(DISTINCT family.family_id, ', ' ORDER BY family.family_id)
                   FILTER (WHERE credential.family_id IS NOT NULL AND NOT credential.has_recovery), 'nenhuma') AS missing_recovery_ids,
               COALESCE(string_agg(DISTINCT
                   family.family_id
                   || ':credential=' || (credential.family_id IS NOT NULL)::text
                   || ':recovery=' || (credential.family_id IS NOT NULL AND credential.has_recovery)::text
                   || ':financial=' || (financial.family_id IS NOT NULL)::text
                   || ':records=' || COALESCE(financial.financial_records, 0)::text
                   || ':attachments=' || COALESCE(financial.attachment_records, 0)::text
                   || ':storage_refs=' || COALESCE(financial.storage_references, 0)::text,
                   ' | '), 'nenhuma familia') AS family_inventory,
               COALESCE(sum(financial.financial_records), 0) AS financial_records,
               COALESCE(sum(financial.attachment_records), 0) AS attachment_records,
               COALESCE(sum(financial.storage_references), 0) AS storage_references
        FROM families AS family
        LEFT JOIN credential_summary AS credential ON credential.family_id = family.family_id
        LEFT JOIN financial_summary AS financial ON financial.family_id = family.family_id
    $family$, false, true, '') END AS document
    FROM family_capability
),
family_values AS (
    SELECT parsed.*
    FROM family_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS
        total_families text PATH 'total_families',
        with_credentials text PATH 'with_credentials',
        without_credentials text PATH 'without_credentials',
        without_recovery text PATH 'without_recovery',
        with_financial_data text PATH 'with_financial_data',
        missing_credential_ids text PATH 'missing_credential_ids',
        missing_recovery_ids text PATH 'missing_recovery_ids',
        family_inventory text PATH 'family_inventory',
        financial_records text PATH 'financial_records',
        attachment_records text PATH 'attachment_records',
        storage_references text PATH 'storage_references'
    ) AS parsed
),
spreadsheet_capability AS (
    SELECT to_regclass('public.homefin_spreadsheets') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_spreadsheets' AND column_name='family_id')
       AND CASE WHEN to_regclass('public.homefin_spreadsheets') IS NULL THEN false
                ELSE has_table_privilege(current_user, to_regclass('public.homefin_spreadsheets'), 'SELECT') END
       AS can_query
),
spreadsheet_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml(
        'SELECT COALESCE(string_agg(family_id || ''='' || record_count, ''; '' ORDER BY family_id), ''nenhuma planilha'') AS by_family, COALESCE(sum(record_count), 0) AS total FROM (SELECT family_id, count(*) AS record_count FROM public.homefin_spreadsheets GROUP BY family_id) AS counts',
        false, true, ''
    ) END AS document FROM spreadsheet_capability
),
spreadsheet_values AS (
    SELECT parsed.* FROM spreadsheet_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS
        by_family text PATH 'by_family', total text PATH 'total') AS parsed
),
payment_capability AS (
    SELECT to_regclass('public.homefin_payments') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_payments' AND column_name='family_id')
       AND CASE WHEN to_regclass('public.homefin_payments') IS NULL THEN false
                ELSE has_table_privilege(current_user, to_regclass('public.homefin_payments'), 'SELECT') END
       AS can_query
),
payment_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml(
        'SELECT COALESCE(string_agg(family_id || ''='' || record_count, ''; '' ORDER BY family_id), ''nenhum pagamento'') AS by_family, COALESCE(sum(record_count), 0) AS total FROM (SELECT family_id, count(*) AS record_count FROM public.homefin_payments GROUP BY family_id) AS counts',
        false, true, ''
    ) END AS document FROM payment_capability
),
payment_values AS (
    SELECT parsed.* FROM payment_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS
        by_family text PATH 'by_family', total text PATH 'total') AS parsed
),
bucket_capability AS (
    SELECT to_regclass('storage.buckets') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='public')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='file_size_limit')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='buckets' AND column_name='allowed_mime_types')
       AND CASE WHEN to_regclass('storage.buckets') IS NULL THEN false
                ELSE has_table_privilege(current_user, to_regclass('storage.buckets'), 'SELECT') END
       AS can_query
),
bucket_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml(
        'SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = ''attachments''',
        false, true, ''
    ) END AS document FROM bucket_capability
),
bucket_values AS (
    SELECT parsed.* FROM bucket_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS
        bucket_id text PATH 'id', is_public text PATH 'public',
        file_size_limit text PATH 'file_size_limit', allowed_mime_types text PATH 'allowed_mime_types') AS parsed
),
object_capability AS (
    SELECT to_regclass('storage.objects') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects' AND column_name='bucket_id')
       AND CASE WHEN to_regclass('storage.objects') IS NULL THEN false
                ELSE has_table_privilege(current_user, to_regclass('storage.objects'), 'SELECT') END
       AS can_query
),
object_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml(
        'SELECT count(*) AS object_count FROM storage.objects WHERE bucket_id = ''attachments''',
        false, true, ''
    ) END AS document FROM object_capability
),
object_values AS (
    SELECT parsed.object_count FROM object_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS object_count text PATH 'object_count') AS parsed
),
global_capability AS (
    SELECT to_regclass('public.homefin_saas') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='homefin_saas' AND column_name='id')
       AND CASE WHEN to_regclass('public.homefin_saas') IS NULL THEN false
                ELSE has_table_privilege(current_user, to_regclass('public.homefin_saas'), 'SELECT') END
       AS can_query
),
global_xml AS (
    SELECT CASE WHEN can_query THEN query_to_xml(
        'SELECT count(*) AS global_record_count FROM public.homefin_saas WHERE id = ''global''',
        false, true, ''
    ) END AS document FROM global_capability
),
global_values AS (
    SELECT parsed.global_record_count FROM global_xml AS source
    CROSS JOIN XMLTABLE('/table/row' PASSING source.document COLUMNS
        global_record_count text PATH 'global_record_count') AS parsed
),
role_checks AS (
    SELECT
        'RLS e permissões'::text AS category,
        'Papel PostgreSQL ' || expected.role_name AS check_name,
        COALESCE(actual.rolname::text || '; can_login=' || actual.rolcanlogin::text || '; superuser=' || actual.rolsuper::text, 'ausente') AS found,
        CASE WHEN actual.rolname IS NULL THEN 'ATENÇÃO' ELSE 'OK' END AS situation,
        CASE WHEN actual.rolname IS NULL THEN 'Papel esperado nao encontrado neste projeto.' END AS problem
    FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS expected(role_name)
    LEFT JOIN pg_roles AS actual ON actual.rolname::text = expected.role_name
),
storage_grant_check AS (
    SELECT
        'Storage e bucket attachments'::text AS category,
        'Grants globais em storage.objects'::text AS check_name,
        CASE
            WHEN relation.oid IS NULL THEN 'nao verificavel: storage.objects ausente'
            ELSE 'PUBLIC ACL=' || COALESCE(public_acl.privileges, 'nenhum')
                 || '; anon CRUD=' || COALESCE(access_values.anon_crud, 'indisponivel')
                 || '; authenticated CRUD=' || COALESCE(access_values.authenticated_crud, 'indisponivel')
                 || '; service_role CRUD=' || COALESCE(access_values.service_role_crud, 'indisponivel')
        END AS found,
        CASE
            WHEN relation.oid IS NULL THEN 'ATENÇÃO'
            WHEN service_role.rolname IS NULL THEN 'BLOQUEIO'
            WHEN access_values.service_role_has_all_crud IS NOT TRUE THEN 'BLOQUEIO'
            WHEN client_roles.anon_name IS NULL OR client_roles.authenticated_name IS NULL THEN 'ATENÇÃO'
            WHEN public_acl.has_public_access
              OR access_values.anon_has_access
              OR access_values.authenticated_has_access THEN 'ATENÇÃO'
            ELSE 'OK'
        END AS situation,
        CASE
            WHEN relation.oid IS NULL THEN 'Nao foi possivel consultar os grants do Storage.'
            WHEN service_role.rolname IS NULL OR access_values.service_role_has_all_crud IS NOT TRUE
                THEN 'O acesso server-side do service_role a storage.objects nao foi confirmado.'
            WHEN client_roles.anon_name IS NULL OR client_roles.authenticated_name IS NULL
                THEN 'Nao foi possivel avaliar o acesso efetivo dos papeis clientes.'
            WHEN public_acl.has_public_access
              OR access_values.anon_has_access
              OR access_values.authenticated_has_access
                THEN 'Esses grants sao globais a storage.objects; nao os remova com base apenas nesta linha, pois podem afetar outros buckets. Valide a policy restritiva especifica de attachments.'
        END AS problem
    FROM (VALUES (1)) AS singleton(value)
    LEFT JOIN pg_class AS relation ON relation.oid = to_regclass('storage.objects')
    LEFT JOIN pg_roles AS service_role ON service_role.rolname = 'service_role'
    LEFT JOIN LATERAL (
        SELECT
            (SELECT role.rolname FROM pg_roles AS role WHERE role.rolname = 'anon') AS anon_name,
            (SELECT role.rolname FROM pg_roles AS role WHERE role.rolname = 'authenticated') AS authenticated_name
    ) AS client_roles ON true
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(bool_or(acl.privilege_type IN
                ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')), false) AS has_public_access,
            string_agg(acl.privilege_type, ',' ORDER BY acl.privilege_type) FILTER (
                WHERE acl.privilege_type IN
                    ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
            ) AS privileges
        FROM aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) AS acl
        WHERE acl.grantee = 0
    ) AS public_acl ON relation.oid IS NOT NULL
    LEFT JOIN LATERAL (
        SELECT
            CASE WHEN client_roles.anon_name IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(client_roles.anon_name, relation.oid, 'SELECT')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'INSERT')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'UPDATE')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'DELETE')
                   OR has_table_privilege(client_roles.anon_name, relation.oid, 'TRUNCATE')
            END AS anon_has_access,
            CASE WHEN client_roles.authenticated_name IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(client_roles.authenticated_name, relation.oid, 'SELECT')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'INSERT')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'UPDATE')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'DELETE')
                   OR has_table_privilege(client_roles.authenticated_name, relation.oid, 'TRUNCATE')
            END AS authenticated_has_access,
            CASE WHEN service_role.rolname IS NULL OR relation.oid IS NULL THEN NULL
                 ELSE has_table_privilege(service_role.rolname, relation.oid, 'SELECT')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'INSERT')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'UPDATE')
                   AND has_table_privilege(service_role.rolname, relation.oid, 'DELETE')
            END AS service_role_has_all_crud,
            CASE WHEN client_roles.anon_name IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(client_roles.anon_name, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(client_roles.anon_name, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'DELETE')::text
                     || ',TRUNCATE=' || has_table_privilege(client_roles.anon_name, relation.oid, 'TRUNCATE')::text
            END AS anon_crud,
            CASE WHEN client_roles.authenticated_name IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'DELETE')::text
                     || ',TRUNCATE=' || has_table_privilege(client_roles.authenticated_name, relation.oid, 'TRUNCATE')::text
            END AS authenticated_crud,
            CASE WHEN service_role.rolname IS NULL OR relation.oid IS NULL THEN 'indisponivel'
                 ELSE 'SELECT=' || has_table_privilege(service_role.rolname, relation.oid, 'SELECT')::text
                     || ',INSERT=' || has_table_privilege(service_role.rolname, relation.oid, 'INSERT')::text
                     || ',UPDATE=' || has_table_privilege(service_role.rolname, relation.oid, 'UPDATE')::text
                     || ',DELETE=' || has_table_privilege(service_role.rolname, relation.oid, 'DELETE')::text
            END AS service_role_crud
    ) AS access_values ON true
),
checks AS (
    SELECT * FROM table_checks
    UNION ALL SELECT * FROM column_checks
    UNION ALL SELECT * FROM index_checks
    UNION ALL SELECT * FROM rpc_checks
    UNION ALL SELECT * FROM other_rpc_checks
    UNION ALL SELECT * FROM rls_checks
    UNION ALL SELECT * FROM grant_checks
    UNION ALL SELECT * FROM policy_checks
    UNION ALL SELECT * FROM policy_absence_checks
    UNION ALL SELECT * FROM storage_policy_check
    UNION ALL SELECT * FROM role_checks
    UNION ALL SELECT * FROM storage_grant_check
    UNION ALL
    SELECT 'Pré-requisitos das migrações', 'Registro global homefin_saas',
           CASE WHEN source.document IS NULL THEN 'nao verificavel: tabela/coluna ausente'
                WHEN value.global_record_count::int > 0 THEN 'registro global presente'
                ELSE 'registro global ausente' END,
           CASE WHEN source.document IS NULL THEN 'BLOQUEIO'
                WHEN value.global_record_count::int > 0 THEN 'OK' ELSE 'BLOQUEIO' END,
           CASE WHEN source.document IS NULL THEN 'A tabela base ou a coluna id precisa existir para avaliar o registro global.'
                WHEN value.global_record_count::int = 0 THEN 'RPCs de cadastro e pagamentos dependem do registro global.' END
    FROM global_xml AS source LEFT JOIN global_values AS value ON true
    UNION ALL
    SELECT 'Famílias cadastradas', 'Inventário de famílias',
           CASE WHEN source.document IS NULL THEN 'nao verificavel: schema ausente/incompativel ou sem SELECT para o executor'
                ELSE 'familias=' || value.total_families || '; com dados financeiros=' || value.with_financial_data
                     || '; por familia=' || value.family_inventory END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'Inventario indisponivel: confira schema e SELECT do usuario do SQL Editor em homefin_saas, homefin_family_credentials e homefin_data.' END
    FROM family_xml AS source LEFT JOIN family_values AS value ON true
    UNION ALL
    SELECT 'Credenciais server-side', 'Famílias com credencial',
           CASE WHEN source.document IS NULL THEN 'nao verificavel'
                ELSE 'com credencial=' || value.with_credentials || '; sem credencial=' || value.without_credentials
                     || '; IDs sem credencial=' || value.missing_credential_ids END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO'
                WHEN value.without_credentials::int > 0 THEN 'BLOQUEIO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'Tabelas/colunas necessarias ausentes/incompativeis ou SELECT do executor insuficiente.'
                WHEN value.without_credentials::int > 0 THEN 'Provisionar as familias legadas por fluxo server-side antes de revogar o acesso antigo.' END
    FROM family_xml AS source LEFT JOIN family_values AS value ON true
    UNION ALL
    SELECT 'Recuperação de PIN', 'Famílias sem hash de recuperação',
           CASE WHEN source.document IS NULL THEN 'nao verificavel'
                ELSE 'sem recuperacao=' || value.without_recovery || '; IDs=' || value.missing_recovery_ids END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO'
                WHEN value.without_recovery::int > 0 THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'Tabela de credenciais ausente/incompativel ou SELECT do executor insuficiente.'
                WHEN value.without_recovery::int > 0 THEN 'Essas familias devem configurar recuperacao apos login valido.' END
    FROM family_xml AS source LEFT JOIN family_values AS value ON true
    UNION ALL
    SELECT 'Famílias cadastradas', 'Dados financeiros e anexos',
           CASE WHEN source.document IS NULL THEN 'nao verificavel'
                ELSE 'registros financeiros=' || value.financial_records
                     || '; anexos=' || value.attachment_records
                     || '; referencias Storage=' || value.storage_references END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'A consulta depende do schema de dados financeiros e das tabelas de credenciais.' END
    FROM family_xml AS source LEFT JOIN family_values AS value ON true
    UNION ALL
    SELECT 'Planilhas e pagamentos', 'Planilhas por familia',
           CASE WHEN source.document IS NULL THEN 'nao verificavel: tabela/coluna ausente'
                ELSE 'total=' || value.total || '; por familia=' || value.by_family END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'Tabela/coluna ausente ou sem SELECT para o usuario do SQL Editor.' END
    FROM spreadsheet_xml AS source LEFT JOIN spreadsheet_values AS value ON true
    UNION ALL
    SELECT 'Planilhas e pagamentos', 'Pagamentos por familia',
           CASE WHEN source.document IS NULL THEN 'nao verificavel: tabela/coluna ausente'
                ELSE 'total=' || value.total || '; por familia=' || value.by_family END,
           CASE WHEN source.document IS NULL THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN source.document IS NULL THEN 'Tabela/coluna ausente ou sem SELECT para o usuario do SQL Editor.' END
    FROM payment_xml AS source LEFT JOIN payment_values AS value ON true
    UNION ALL
    SELECT 'Storage e bucket attachments', 'Bucket attachments',
           CASE
             WHEN NOT (SELECT can_query FROM bucket_capability) THEN 'nao verificavel: storage.buckets indisponivel'
             WHEN value.bucket_id IS NULL THEN 'bucket ausente'
             ELSE 'presente; publico=' || value.is_public || '; limite=' || COALESCE(value.file_size_limit, 'null')
                  || '; MIME=' || COALESCE(value.allowed_mime_types, 'null')
           END,
           CASE WHEN NOT (SELECT can_query FROM bucket_capability) OR value.bucket_id IS NULL THEN 'BLOQUEIO'
                WHEN value.is_public = 'true' THEN 'BLOQUEIO' ELSE 'OK' END,
           CASE WHEN NOT (SELECT can_query FROM bucket_capability) THEN 'Estrutura do bucket indisponivel ou usuario do SQL Editor sem SELECT em storage.buckets.'
                WHEN value.bucket_id IS NULL THEN 'Bucket attachments precisa existir.'
                WHEN value.is_public = 'true' THEN 'Bucket deve ser privado antes do hardening.' END
    FROM (SELECT 1) AS singleton LEFT JOIN bucket_values AS value ON true
    UNION ALL
    SELECT 'Storage e bucket attachments', 'Objetos armazenados em attachments',
           CASE WHEN NOT (SELECT can_query FROM object_capability) THEN 'nao verificavel: storage.objects indisponivel'
                ELSE 'quantidade=' || COALESCE(value.object_count, '0') END,
           CASE WHEN NOT (SELECT can_query FROM object_capability) THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN NOT (SELECT can_query FROM object_capability) THEN 'Tabela/coluna indisponivel ou usuario do SQL Editor sem SELECT em storage.objects.' END
    FROM (SELECT 1) AS singleton LEFT JOIN object_values AS value ON true
    UNION ALL
    SELECT 'Notificações e suporte', 'Inscrições Push',
           CASE WHEN to_regclass('public.homefin_push_subscriptions') IS NULL THEN 'nao verificavel: tabela ausente'
                ELSE 'tabela presente; valide estrutura, RLS, grants e policies nas linhas acima' END,
           CASE WHEN to_regclass('public.homefin_push_subscriptions') IS NULL THEN 'ATENÇÃO' ELSE 'OK' END,
           CASE WHEN to_regclass('public.homefin_push_subscriptions') IS NULL THEN 'Tabela Push ainda nao existe.' END
    UNION ALL
    SELECT 'Notificações e suporte', 'Tabelas de suporte',
           CASE WHEN to_regclass('public.homefin_support_messages') IS NOT NULL
                  AND to_regclass('public.homefin_support_settings') IS NOT NULL
                THEN 'mensagens e configuracoes presentes'
                ELSE 'uma ou mais tabelas ausentes' END,
           CASE WHEN to_regclass('public.homefin_support_messages') IS NOT NULL
                  AND to_regclass('public.homefin_support_settings') IS NOT NULL THEN 'OK' ELSE 'ATENÇÃO' END,
           CASE WHEN to_regclass('public.homefin_support_messages') IS NULL
                  OR to_regclass('public.homefin_support_settings') IS NULL
                THEN 'Tabelas criadas pela migracao de hardening ainda nao estao todas presentes.' END
)
SELECT category, check_name, found AS resultado_encontrado, situation AS situacao, problem AS descricao_problema
FROM checks
ORDER BY category, check_name;
