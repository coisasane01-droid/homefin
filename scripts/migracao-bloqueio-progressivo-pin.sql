-- HomeFin: permite até 20 falhas por família/IP em uma janela móvel de 1 hora.
-- O bloqueio progressivo é calculado pela API a partir dos registros:
-- 1ª=15s, 2ª=30s, 3ª=1min, 4ª=5min, 5ª=15min, 6ª+=1h.
-- A trava por IP continua limitada a 20 falhas/hora.
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

    IF v_family_count >= 20 OR v_ip_count >= 20 THEN
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
