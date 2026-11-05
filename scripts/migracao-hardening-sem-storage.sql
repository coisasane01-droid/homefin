-- HomeFin: hardening server-side da autenticacao, dados familiares e Push.
-- Executar manualmente no SQL Editor do Supabase. Esta migracao nao foi executada.
-- Pressupoe que homefin_saas, homefin_data e as migracoes familiares existentes ja existem.

-- Credenciais e tentativas de autenticacao.
ALTER TABLE public.homefin_family_credentials
    ADD COLUMN IF NOT EXISTS recovery_salt text,
    ADD COLUMN IF NOT EXISTS recovery_hash text,
    ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.homefin_auth_attempts
    ADD COLUMN IF NOT EXISTS ip_hash text;

CREATE INDEX IF NOT EXISTS homefin_auth_attempts_ip_time_idx
    ON public.homefin_auth_attempts (ip_hash, attempted_at DESC)
    WHERE ip_hash IS NOT NULL;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_catalog.pg_constraint
         WHERE conname = 'homefin_family_credentials_recovery_format'
           AND conrelid = 'public.homefin_family_credentials'::regclass
    ) THEN
        ALTER TABLE public.homefin_family_credentials
            ADD CONSTRAINT homefin_family_credentials_recovery_format
            CHECK (
                (recovery_salt IS NULL AND recovery_hash IS NULL)
                OR (
                    recovery_salt IS NOT NULL
                    AND recovery_hash IS NOT NULL
                    AND recovery_salt ~ '^[a-f0-9]{32}$'
                    AND recovery_hash ~ '^[a-f0-9]{128}$'
                )
            );
    END IF;
END;
$block$;

DO $block$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_catalog.pg_constraint
         WHERE conname = 'homefin_family_credentials_session_version_positive'
           AND conrelid = 'public.homefin_family_credentials'::regclass
    ) THEN
        ALTER TABLE public.homefin_family_credentials
            ADD CONSTRAINT homefin_family_credentials_session_version_positive
            CHECK (session_version >= 1);
    END IF;
END;
$block$;

-- Registra falhas atomicamente, limitando 5 tentativas por família e 20 por IP/hora.
CREATE OR REPLACE FUNCTION public.homefin_register_auth_failure(
    p_family_id text,
    p_ip_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_family_count integer;
    v_ip_count integer;
BEGIN
    IF p_family_id IS NULL
       OR p_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
       OR p_ip_hash IS NULL
       OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
        RETURN false;
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('family:' || p_family_id, 0)
    );
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('ip:' || p_ip_hash, 0)
    );

    SELECT count(*)::integer
      INTO v_family_count
      FROM public.homefin_auth_attempts
     WHERE family_id = p_family_id
       AND attempted_at >= pg_catalog.now() - interval '1 hour';

    SELECT count(*)::integer
      INTO v_ip_count
      FROM public.homefin_auth_attempts
     WHERE ip_hash = p_ip_hash
       AND attempted_at >= pg_catalog.now() - interval '1 hour';

    IF v_family_count >= 5 OR v_ip_count >= 20 THEN
        RETURN false;
    END IF;

    INSERT INTO public.homefin_auth_attempts (family_id, ip_hash, attempted_at)
    VALUES (p_family_id, p_ip_hash, pg_catalog.now());
    RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_register_auth_failure(text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_register_auth_failure(text, text)
    TO service_role;

-- Cadastro transacional de família, PIN e recuperação com hashes produzidos no servidor.
CREATE OR REPLACE FUNCTION public.homefin_create_family_with_credentials(
    p_family jsonb,
    p_pin_salt text,
    p_pin_hash text,
    p_recovery_salt text,
    p_recovery_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_family_id text;
    v_data jsonb;
    v_families jsonb;
BEGIN
    v_family_id := p_family->>'id';

    IF v_family_id IS NULL
       OR v_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
       OR coalesce(pg_catalog.btrim(p_family->>'name'), '') = '' THEN
        RAISE EXCEPTION 'Identificador ou nome de familia invalido.';
    END IF;

    IF p_pin_salt IS NULL OR p_pin_salt !~ '^[a-f0-9]{32}$'
       OR p_pin_hash IS NULL OR p_pin_hash !~ '^[a-f0-9]{128}$'
       OR p_recovery_salt IS NULL OR p_recovery_salt !~ '^[a-f0-9]{32}$'
       OR p_recovery_hash IS NULL OR p_recovery_hash !~ '^[a-f0-9]{128}$' THEN
        RAISE EXCEPTION 'Credencial invalida.';
    END IF;

    SELECT data
      INTO v_data
      FROM public.homefin_saas
     WHERE id = 'global'
     FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro global do HomeFin nao encontrado.';
    END IF;

    v_families := CASE
        WHEN pg_catalog.jsonb_typeof(v_data->'families') = 'array'
            THEN v_data->'families'
        ELSE '[]'::jsonb
    END;

    IF EXISTS (
        SELECT 1
          FROM pg_catalog.jsonb_array_elements(v_families) AS f(value)
         WHERE f.value->>'id' = v_family_id
    ) OR EXISTS (
        SELECT 1
          FROM public.homefin_family_credentials c
         WHERE c.family_id = v_family_id
    ) THEN
        RAISE EXCEPTION 'Este identificador de familia ja existe.';
    END IF;

    UPDATE public.homefin_saas
       SET data = pg_catalog.jsonb_set(
               coalesce(v_data, '{}'::jsonb),
               '{families}',
               v_families || pg_catalog.jsonb_build_array(p_family),
               true
           ),
           updated_at = pg_catalog.now()
     WHERE id = 'global';

    INSERT INTO public.homefin_family_credentials (
        family_id, pin_salt, pin_hash, recovery_salt, recovery_hash, session_version
    ) VALUES (
        v_family_id, p_pin_salt, p_pin_hash, p_recovery_salt, p_recovery_hash, 1
    );

    RETURN pg_catalog.jsonb_build_object('success', true, 'familyId', v_family_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_create_family_with_credentials(jsonb, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_create_family_with_credentials(jsonb, text, text, text, text)
    TO service_role;

DO $block$
BEGIN
    IF pg_catalog.to_regprocedure(
        'public.homefin_create_family_with_credentials(jsonb,text,text)'
    ) IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.homefin_create_family_with_credentials(jsonb, text, text) FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.homefin_create_family_with_credentials(jsonb, text, text) TO service_role';
    END IF;
    IF pg_catalog.to_regprocedure(
        'public.homefin_register_auth_failure(text)'
    ) IS NOT NULL THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.homefin_register_auth_failure(text) FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.homefin_register_auth_failure(text) TO service_role';
    END IF;
END;
$block$;

-- Tabelas próprias usadas pelas APIs autenticadas de suporte e Push.
CREATE TABLE IF NOT EXISTS public.homefin_support_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id text NOT NULL,
    sender_type text NOT NULL CHECK (sender_type IN ('family', 'admin')),
    message text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homefin_support_messages_family_time_idx
    ON public.homefin_support_messages (family_id, created_at);

CREATE TABLE IF NOT EXISTS public.homefin_support_settings (
    family_id text PRIMARY KEY,
    blocked boolean NOT NULL DEFAULT false,
    resolved boolean NOT NULL DEFAULT false,
    resolved_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.homefin_push_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id text NOT NULL,
    user_type text NOT NULL CHECK (user_type IN ('family', 'admin')),
    endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
    subscription jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homefin_push_subscriptions_identity_idx
    ON public.homefin_push_subscriptions (family_id, user_type);

CREATE TABLE IF NOT EXISTS public.homefin_storage_cleanup_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id text NOT NULL,
    object_paths jsonb NOT NULL CHECK (jsonb_typeof(object_paths) = 'array'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homefin_storage_cleanup_queue_created_idx
    ON public.homefin_storage_cleanup_queue (created_at);

CREATE TABLE IF NOT EXISTS public.homefin_spreadsheets (
    id uuid PRIMARY KEY,
    family_id text NOT NULL,
    name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
    reference_month integer NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
    reference_year integer NOT NULL CHECK (reference_year BETWEEN 2000 AND 9999),
    "columns" jsonb NOT NULL CHECK (jsonb_typeof("columns") = 'array'),
    "rows" jsonb NOT NULL CHECK (jsonb_typeof("rows") = 'array'),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_family_id_idx
    ON public.homefin_spreadsheets (family_id);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_reference_year_idx
    ON public.homefin_spreadsheets (reference_year);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_reference_month_idx
    ON public.homefin_spreadsheets (reference_month);
CREATE INDEX IF NOT EXISTS homefin_spreadsheets_family_period_idx
    ON public.homefin_spreadsheets (family_id, reference_year DESC, reference_month DESC);

-- RLS e grants fechados: leitura/escrita somente por APIs server-side.
ALTER TABLE public.homefin_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_saas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_family_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_support_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_storage_cleanup_queue ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.homefin_data FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_saas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_family_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_auth_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_support_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_support_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_push_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.homefin_storage_cleanup_queue FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_data TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_saas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_family_credentials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_auth_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_support_messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_support_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_storage_cleanup_queue TO service_role;

DO $block$
BEGIN
    IF pg_catalog.to_regclass('public.homefin_spreadsheets') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.homefin_spreadsheets ENABLE ROW LEVEL SECURITY';
        EXECUTE 'REVOKE ALL ON public.homefin_spreadsheets FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_spreadsheets TO service_role';
    END IF;

    IF pg_catalog.to_regclass('public.homefin_payments') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.homefin_payments ENABLE ROW LEVEL SECURITY';
        EXECUTE 'REVOKE ALL ON public.homefin_payments FROM PUBLIC, anon, authenticated';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_payments TO service_role';
    END IF;
END;
$block$;

-- Storage: bucket attachments ja confirmado como privado.

-- Exclusão de família confirmada: todas as linhas relacionadas são removidas numa transação.
CREATE OR REPLACE FUNCTION public.homefin_delete_family(p_family_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_data jsonb;
    v_families jsonb;
BEGIN
    IF p_family_id IS NULL OR p_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' THEN
        RETURN false;
    END IF;

    SELECT data INTO v_data
      FROM public.homefin_saas
     WHERE id = 'global'
     FOR UPDATE;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    v_families := CASE
        WHEN pg_catalog.jsonb_typeof(v_data->'families') = 'array'
            THEN v_data->'families'
        ELSE '[]'::jsonb
    END;

    DELETE FROM public.homefin_data WHERE family_id = p_family_id;
    DELETE FROM public.homefin_spreadsheets WHERE family_id = p_family_id;
    DELETE FROM public.homefin_support_messages WHERE family_id = p_family_id;
    DELETE FROM public.homefin_support_settings WHERE family_id = p_family_id;
    DELETE FROM public.homefin_push_subscriptions WHERE family_id = p_family_id;
    DELETE FROM public.homefin_auth_attempts WHERE family_id = p_family_id;
    DELETE FROM public.homefin_family_credentials WHERE family_id = p_family_id;

    IF pg_catalog.to_regclass('public.homefin_payments') IS NOT NULL THEN
        EXECUTE 'DELETE FROM public.homefin_payments WHERE family_id = $1'
        USING p_family_id;
    END IF;

    UPDATE public.homefin_saas
       SET data = pg_catalog.jsonb_set(
               coalesce(v_data, '{}'::jsonb),
               '{families}',
               COALESCE(
                   (
                       SELECT pg_catalog.jsonb_agg(f.value ORDER BY f.ordinality)
                         FROM pg_catalog.jsonb_array_elements(v_families)
                              WITH ORDINALITY AS f(value, ordinality)
                        WHERE f.value->>'id' <> p_family_id
                   ),
                   '[]'::jsonb
               ),
               true
           ),
           updated_at = pg_catalog.now()
     WHERE id = 'global';

    RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_delete_family(text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_delete_family(text)
    TO service_role;
