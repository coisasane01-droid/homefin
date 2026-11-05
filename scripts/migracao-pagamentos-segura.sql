-- HomeFin: estrutura segura para registrar pagamentos e ativar planos.
-- Executar somente após revisão no Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.homefin_payments (
    payment_id text PRIMARY KEY,
    family_id text NOT NULL,
    plan_id text NOT NULL,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
    status text NOT NULL DEFAULT 'approved' CHECK (status = 'approved'),
    created_at timestamptz NOT NULL DEFAULT now(),
    activated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homefin_payments_family_created_idx
ON public.homefin_payments (family_id, created_at DESC);

ALTER TABLE public.homefin_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.homefin_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_payments TO service_role;

CREATE OR REPLACE FUNCTION public.homefin_activate_paid_plan(
    p_payment_id text,
    p_family_id text,
    p_plan_id text,
    p_amount numeric,
    p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_data jsonb;
    v_plans jsonb;
    v_families jsonb;
    v_plan jsonb;
    v_family jsonb;
    v_new_families jsonb;
    v_period text;
    v_interval interval;
    v_now timestamptz := now();
    v_expires timestamptz;
    v_existing public.homefin_payments%ROWTYPE;
BEGIN
    IF p_payment_id IS NULL OR btrim(p_payment_id) = ''
       OR p_family_id IS NULL OR btrim(p_family_id) = ''
       OR p_family_id = 'v1'
       OR p_plan_id IS NULL OR btrim(p_plan_id) = ''
       OR p_amount IS NULL OR p_amount <= 0
       OR p_currency IS NULL OR p_currency <> 'BRL' THEN
        RAISE EXCEPTION 'Dados de pagamento inválidos';
    END IF;

    SELECT data
      INTO v_data
      FROM public.homefin_saas
     WHERE id = 'global'
     FOR UPDATE;

    IF v_data IS NULL THEN
        RAISE EXCEPTION 'Configuração global não encontrada';
    END IF;

    v_plans := COALESCE(v_data->'plans', '[]'::jsonb);
    v_families := COALESCE(v_data->'families', '[]'::jsonb);

    SELECT item.value
      INTO v_plan
      FROM jsonb_array_elements(v_plans) AS item(value)
     WHERE item.value->>'id' = p_plan_id
     LIMIT 1;

    IF v_plan IS NULL OR p_plan_id = 'free'
       OR (v_plan->>'price') IS NULL
       OR (v_plan->>'price')::numeric <> p_amount THEN
        RAISE EXCEPTION 'Plano ou valor não corresponde à configuração atual';
    END IF;

    v_period := lower(COALESCE(v_plan->>'period', ''));

    IF v_period LIKE '%ano%' THEN
        v_interval := interval '1 year';
    ELSIF v_period LIKE '%mes%' OR v_period LIKE '%mês%' THEN
        v_interval := interval '1 month';
    ELSE
        RAISE EXCEPTION 'Periodicidade do plano não reconhecida';
    END IF;

    SELECT item.value
      INTO v_family
      FROM jsonb_array_elements(v_families) AS item(value)
     WHERE item.value->>'id' = p_family_id
     LIMIT 1;

    IF v_family IS NULL THEN
        RAISE EXCEPTION 'Família não encontrada';
    END IF;

    SELECT *
      INTO v_existing
      FROM public.homefin_payments
     WHERE payment_id = p_payment_id;

    IF FOUND THEN
        IF v_existing.family_id <> p_family_id
           OR v_existing.plan_id <> p_plan_id
           OR v_existing.amount <> p_amount
           OR v_existing.currency <> p_currency THEN
            RAISE EXCEPTION 'Identificador de pagamento já utilizado com outros dados';
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'family_id', p_family_id,
            'plan_id', p_plan_id
        );
    END IF;

    INSERT INTO public.homefin_payments
        (payment_id, family_id, plan_id, amount, currency)
    VALUES
        (p_payment_id, p_family_id, p_plan_id, p_amount, p_currency);

    BEGIN
        v_expires := (v_family->>'expiresAt')::timestamptz;
    EXCEPTION WHEN OTHERS THEN
        v_expires := NULL;
    END;

    IF v_expires IS NULL OR v_expires < v_now THEN
        v_expires := v_now;
    END IF;

    v_expires := v_expires + v_interval;

    SELECT COALESCE(
        jsonb_agg(
            CASE
                WHEN item.value->>'id' = p_family_id
                THEN jsonb_set(
                    jsonb_set(item.value, '{plan}', to_jsonb(p_plan_id), true),
                    '{expiresAt}', to_jsonb(v_expires::text), true
                )
                ELSE item.value
            END
            ORDER BY item.ordinality
        ),
        '[]'::jsonb
    )
    INTO v_new_families
    FROM jsonb_array_elements(v_families)
         WITH ORDINALITY AS item(value, ordinality);

    UPDATE public.homefin_saas
       SET data = jsonb_set(v_data, '{families}', v_new_families, true)
     WHERE id = 'global';

    UPDATE public.homefin_payments
       SET activated_at = v_now
     WHERE payment_id = p_payment_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'family_id', p_family_id,
        'plan_id', p_plan_id,
        'expires_at', v_expires
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_activate_paid_plan(text, text, text, numeric, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_activate_paid_plan(text, text, text, numeric, text)
TO service_role;
