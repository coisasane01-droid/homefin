-- HomeFin: prazo configurável das assinaturas pagas.
-- Execute uma única vez no SQL Editor do Supabase após publicar o código.
-- A função lê durationValue/durationUnit do plano salvo em homefin_saas.data->plans.
-- Planos antigos sem esses campos mantêm compatibilidade com period (/mês ou /ano).
-- Nenhuma assinatura já ativada é alterada por esta migração.

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
  v_duration_value integer;
  v_duration_unit text;
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

  -- Prioriza a duração definida pelo Super Admin.
  -- Compatibilidade: plano antigo mensal = 1 mês; anual = 12 meses.
  IF COALESCE(v_plan->>'durationValue', '') ~ '^[0-9]{1,4}$'
     AND COALESCE(v_plan->>'durationUnit', '') IN ('days', 'months') THEN
    v_duration_value := (v_plan->>'durationValue')::integer;
    v_duration_unit := v_plan->>'durationUnit';
  ELSE
    v_period := lower(COALESCE(v_plan->>'period', '/mês'));
    IF v_period LIKE '%ano%' OR v_period LIKE '%year%' THEN
      v_duration_value := 12;
      v_duration_unit := 'months';
    ELSE
      v_duration_value := 1;
      v_duration_unit := 'months';
    END IF;
  END IF;

  IF v_duration_value < 1
     OR (v_duration_unit = 'days' AND v_duration_value > 3650)
     OR (v_duration_unit = 'months' AND v_duration_value > 120) THEN
    RAISE EXCEPTION 'Duração configurada para o plano é inválida.';
  END IF;

  IF v_duration_unit = 'days' THEN
    v_expires := now() + make_interval(days => v_duration_value);
  ELSE
    v_expires := now() + make_interval(months => v_duration_value);
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

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'family_id', p_family_id,
    'plan_id', p_plan_id,
    'duration_value', v_duration_value,
    'duration_unit', v_duration_unit,
    'expires_at', v_expires
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_confirm_mercado_pago_payment(text, text, text, numeric)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_confirm_mercado_pago_payment(text, text, text, numeric)
TO service_role;
