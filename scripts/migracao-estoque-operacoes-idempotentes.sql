-- HomeFin: movimentacoes idempotentes.
-- NAO EXECUTAR NO SUPABASE AINDA.
BEGIN;

CREATE OR REPLACE FUNCTION public.homefin_inventory_move_idempotent_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_request jsonb;
  v_saved public.homefin_inventory_operations%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_operation_id IS NULL
     OR p_actor_family_id IS NULL OR p_owner_family_id IS NULL
     OR p_actor_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
     OR p_owner_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
     OR p_product_id IS NULL
     OR p_type IS NULL OR p_type NOT IN ('entry', 'exit')
     OR p_quantity IS NULL OR p_quantity <= 0
     OR p_quantity > 100000000
     OR p_quantity <> trunc(p_quantity * 1000) / 1000
     OR p_note IS NULL OR char_length(p_note) > 500 THEN
    RAISE EXCEPTION 'Dados da movimentacao invalidos.'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1
    FROM public.homefin_inventory_shares
    WHERE shared_family_id = p_actor_family_id
      AND owner_family_id = p_owner_family_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acesso compartilhado revogado.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_request := jsonb_build_object(
    'product_id', p_product_id,
    'type', p_type,
    'quantity', p_quantity,
    'note', p_note
  );

  INSERT INTO public.homefin_inventory_operations (
    owner_family_id,
    operation_id,
    actor_family_id,
    operation_type,
    request_payload
  )
  VALUES (
    p_owner_family_id,
    p_operation_id,
    p_actor_family_id,
    'move',
    v_request
  )
  ON CONFLICT (owner_family_id, operation_id) DO NOTHING;

  SELECT *
  INTO v_saved
  FROM public.homefin_inventory_operations
  WHERE owner_family_id = p_owner_family_id
    AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operacao nao localizada.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_saved.actor_family_id IS DISTINCT FROM p_actor_family_id
     OR v_saved.operation_type IS DISTINCT FROM 'move'
     OR v_saved.request_payload IS DISTINCT FROM v_request THEN
    RAISE EXCEPTION 'Identificador reutilizado com dados diferentes.'
      USING ERRCODE = '23505';
  END IF;

  IF v_saved.response_payload IS NOT NULL THEN
    RETURN v_saved.response_payload;
  END IF;

  v_result := public.homefin_inventory_move_authorized(
    p_actor_family_id,
    p_owner_family_id,
    p_product_id,
    p_type,
    p_quantity,
    p_note
  );

  UPDATE public.homefin_inventory_operations
  SET response_payload = v_result
  WHERE owner_family_id = p_owner_family_id
    AND operation_id = p_operation_id;

  RETURN v_result;
END
$function$;

CREATE OR REPLACE FUNCTION public.homefin_inventory_move_batch_idempotent_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_items jsonb,
  p_note text,
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_request jsonb;
  v_saved public.homefin_inventory_operations%ROWTYPE;
  v_result jsonb;
BEGIN
  IF p_operation_id IS NULL
     OR p_actor_family_id IS NULL OR p_owner_family_id IS NULL
     OR p_actor_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
     OR p_owner_family_id !~ '^[a-z0-9][a-z0-9-]{0,99}$'
     OR p_note IS NULL OR char_length(p_note) > 500
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados da baixa em lote invalidos.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'A lista deve conter de 1 a 100 produtos.'
      USING ERRCODE = '22023';
  END IF;

  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1
    FROM public.homefin_inventory_shares
    WHERE shared_family_id = p_actor_family_id
      AND owner_family_id = p_owner_family_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acesso compartilhado revogado.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_request := jsonb_build_object(
    'items', p_items,
    'note', p_note
  );

  INSERT INTO public.homefin_inventory_operations (
    owner_family_id,
    operation_id,
    actor_family_id,
    operation_type,
    request_payload
  )
  VALUES (
    p_owner_family_id,
    p_operation_id,
    p_actor_family_id,
    'move-batch',
    v_request
  )
  ON CONFLICT (owner_family_id, operation_id) DO NOTHING;

  SELECT *
  INTO v_saved
  FROM public.homefin_inventory_operations
  WHERE owner_family_id = p_owner_family_id
    AND operation_id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operacao nao localizada.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_saved.actor_family_id IS DISTINCT FROM p_actor_family_id
     OR v_saved.operation_type IS DISTINCT FROM 'move-batch'
     OR v_saved.request_payload IS DISTINCT FROM v_request THEN
    RAISE EXCEPTION 'Identificador reutilizado com dados diferentes.'
      USING ERRCODE = '23505';
  END IF;

  IF v_saved.response_payload IS NOT NULL THEN
    RETURN v_saved.response_payload;
  END IF;

  v_result := public.homefin_inventory_move_batch_authorized(
    p_actor_family_id,
    p_owner_family_id,
    p_items,
    p_note
  );

  UPDATE public.homefin_inventory_operations
  SET response_payload = v_result
  WHERE owner_family_id = p_owner_family_id
    AND operation_id = p_operation_id;

  RETURN v_result;
END
$function$;

REVOKE ALL ON FUNCTION public.homefin_inventory_move_idempotent_authorized(
  text,text,uuid,text,numeric,text,uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_move_idempotent_authorized(
  text,text,uuid,text,numeric,text,uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.homefin_inventory_move_batch_idempotent_authorized(
  text,text,jsonb,text,uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_move_batch_idempotent_authorized(
  text,text,jsonb,text,uuid
) TO service_role;

COMMIT;
