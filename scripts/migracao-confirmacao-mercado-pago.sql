-- HomeFin: confirmação segura e idempotente de pagamentos Mercado Pago.
-- Execute uma única vez no SQL Editor do Supabase antes de testar pagamentos reais.

CREATE TABLE IF NOT EXISTS public.homefin_mercado_pago_payments (
  payment_id text PRIMARY KEY,
  family_id text NOT NULL,
  plan_id text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  processed_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.homefin_mercado_pago_payments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.homefin_mercado_pago_payments TO service_role;

CREATE OR REPLACE FUNCTION public.homefin_confirm_mercado_pago_payment(
  p_payment_id text,
  p_family_id text,
  p_plan_id text,
  p_amount numeric
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
  v_new_families jsonb := '[]'::jsonb;
  v_period text;
  v_expires timestamptz;
  v_existing public.homefin_mercado_pago_payments%ROWTYPE;
  v_found_family boolean := false;
BEGIN
  IF p_payment_id IS NULL OR p_payment_id !~ '^[0-9]{1,30}$'
     OR p_family_id IS NULL OR length(btrim(p_family_id)) = 0
     OR p_plan_id IS NULL OR length(btrim(p_plan_id)) = 0
     OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Parâmetros de pagamento inválidos.';
  END IF;

  SELECT data INTO v_data
  FROM public.homefin_saas
  WHERE id = 'global'
  FOR UPDATE;

  IF v_data IS NULL THEN
    RAISE EXCEPTION 'Configuração global do HomeFin não encontrada.';
  END IF;

  -- Recheca após obter o lock para tratar notificações simultâneas do mesmo pagamento.
  SELECT * INTO v_existing
  FROM public.homefin_mercado_pago_payments
  WHERE payment_id = p_payment_id;

  IF FOUND THEN
    IF v_existing.family_id <> p_family_id OR v_existing.plan_id <> p_plan_id
       OR abs(v_existing.amount - p_amount) > 0.01 THEN
      RAISE EXCEPTION 'ID de pagamento já utilizado com dados diferentes.';
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  v_plans := COALESCE(v_data->'plans', '[]'::jsonb);
  v_families := COALESCE(v_data->'families', '[]'::jsonb);

  SELECT item INTO v_plan
  FROM jsonb_array_elements(v_plans) AS plans(item)
  WHERE item->>'id' = p_plan_id
  LIMIT 1;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plano associado ao pagamento não existe.';
  END IF;

  IF abs(COALESCE((v_plan->>'price')::numeric, -1) - p_amount) > 0.01 THEN
    RAISE EXCEPTION 'Valor pago não corresponde ao preço atual do plano.';
  END IF;

  v_period := lower(COALESCE(v_plan->>'period', '/mês'));
  IF v_period LIKE '%ano%' OR v_period LIKE '%year%' THEN
    v_expires := now() + interval '1 year';
  ELSIF v_period LIKE '%dia%' OR v_period LIKE '%day%' THEN
    v_expires := now() + interval '1 day';
  ELSIF v_period LIKE '%semana%' OR v_period LIKE '%week%' THEN
    v_expires := now() + interval '1 week';
  ELSE
    v_expires := now() + interval '1 month';
  END IF;

  FOR v_family IN SELECT value FROM jsonb_array_elements(v_families)
  LOOP
    IF v_family->>'id' = p_family_id THEN
      v_found_family := true;
      -- O modelo atual do HomeFin usa 'premium' como marcador de qualquer plano pago.
      v_family := jsonb_set(v_family, '{plan}', to_jsonb('premium'::text), true);
      v_family := jsonb_set(v_family, '{status}', to_jsonb('active'::text), true);
      v_family := jsonb_set(v_family, '{expiresAt}', to_jsonb(v_expires::text), true);
      v_family := jsonb_set(v_family, '{paidPlanId}', to_jsonb(p_plan_id), true);
      v_family := jsonb_set(v_family, '{lastPaymentId}', to_jsonb(p_payment_id), true);
    END IF;
    v_new_families := v_new_families || jsonb_build_array(v_family);
  END LOOP;

  IF NOT v_found_family THEN
    RAISE EXCEPTION 'Família vinculada ao pagamento não foi encontrada.';
  END IF;

  UPDATE public.homefin_saas
  SET data = jsonb_set(v_data, '{families}', v_new_families, true),
      updated_at = now()
  WHERE id = 'global';

  INSERT INTO public.homefin_mercado_pago_payments(payment_id, family_id, plan_id, amount)
  VALUES (p_payment_id, p_family_id, p_plan_id, p_amount);

  RETURN jsonb_build_object('ok', true, 'already_processed', false, 'family_id', p_family_id, 'plan_id', p_plan_id, 'expires_at', v_expires);
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_confirm_mercado_pago_payment(text, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_confirm_mercado_pago_payment(text, text, text, numeric) TO service_role;
