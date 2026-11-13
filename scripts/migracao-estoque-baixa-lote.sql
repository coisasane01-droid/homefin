-- HomeFin: baixa múltipla e atômica do Estoque.
-- Migração aditiva: não altera nem apaga produtos ou movimentações existentes.
-- Execute manualmente no SQL Editor do Supabase somente após os testes locais.

CREATE OR REPLACE FUNCTION public.homefin_inventory_move_batch_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_items jsonb,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric(14,3);
  v_count integer;
  v_locked integer;
  v_product public.homefin_inventory_products%ROWTYPE;
  v_movement public.homefin_inventory_movements%ROWTYPE;
  v_products jsonb := '[]'::jsonb;
  v_movements jsonb := '[]'::jsonb;
BEGIN
  IF p_actor_family_id IS NULL
     OR p_owner_family_id IS NULL
     OR p_note IS NULL
     OR char_length(p_note) > 500 THEN
    RAISE EXCEPTION 'Dados da baixa em lote inválidos.';
  END IF;

  -- Validar o tipo antes de chamar funções específicas de arrays.
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista de produtos deve ser um array JSON.';
  END IF;

  v_count := jsonb_array_length(p_items);

  IF v_count < 1 OR v_count > 100 THEN
    RAISE EXCEPTION 'A lista deve conter de 1 a 100 produtos.';
  END IF;

  -- Validar todos os IDs e quantidades antes de bloquear ou alterar produtos.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR coalesce(v_item->>'product_id', '') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR coalesce(v_item->>'quantity', '') !~ '^[0-9]{1,9}(\.[0-9]{1,3})?$' THEN
      RAISE EXCEPTION 'Produto ou quantidade inválida na baixa em lote.';
    END IF;

    v_quantity := (v_item->>'quantity')::numeric(14,3);
    IF v_quantity <= 0 OR v_quantity > 100000000 THEN
      RAISE EXCEPTION 'Quantidade inválida na baixa em lote.';
    END IF;
  END LOOP;

  -- Não aceitar IDs repetidos.
  IF (
    SELECT count(DISTINCT lower(value->>'product_id'))
    FROM jsonb_array_elements(p_items)
  ) <> v_count THEN
    RAISE EXCEPTION 'A lista contém produtos repetidos.';
  END IF;

  -- Bloquear o vínculo compartilhado até o fim da transação.
  -- Uma revogação concorrente aguardará esta operação terminar.
  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1
    FROM public.homefin_inventory_shares
    WHERE shared_family_id = p_actor_family_id
      AND owner_family_id = p_owner_family_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'O acesso ao Estoque compartilhado foi revogado.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Bloquear todos os produtos em ordem determinística.
  PERFORM p.id
  FROM public.homefin_inventory_products AS p
  JOIN (
    SELECT (value->>'product_id')::uuid AS product_id
    FROM jsonb_array_elements(p_items)
  ) AS requested ON requested.product_id = p.id
  WHERE p.family_id = p_owner_family_id
  ORDER BY p.id
  FOR UPDATE OF p;

  GET DIAGNOSTICS v_locked = ROW_COUNT;

  IF v_locked <> v_count THEN
    RAISE EXCEPTION 'Um ou mais produtos não foram encontrados neste Estoque.';
  END IF;

  -- Conferir o saldo de TODOS antes de efetuar qualquer baixa.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric(14,3);

    SELECT * INTO v_product
    FROM public.homefin_inventory_products
    WHERE family_id = p_owner_family_id
      AND id = v_product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto não encontrado neste Estoque.';
    END IF;

    IF coalesce(v_product.quantity_mode, 'integer') <> 'decimal'
       AND v_quantity <> trunc(v_quantity) THEN
      RAISE EXCEPTION 'O produto % aceita somente quantidades inteiras.', v_product.name;
    END IF;

    IF v_product.quantity < v_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para % (disponível: %, solicitado: %).',
        v_product.name, v_product.quantity, v_quantity;
    END IF;
  END LOOP;

  -- Somente depois de todas as validações, executar as baixas.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric(14,3);

    UPDATE public.homefin_inventory_products
    SET quantity = quantity - v_quantity,
        updated_at = now()
    WHERE family_id = p_owner_family_id
      AND id = v_product_id
    RETURNING * INTO v_product;

    INSERT INTO public.homefin_inventory_movements (
      family_id, product_id, movement_type, quantity, note
    )
    VALUES (
      p_owner_family_id,
      v_product_id,
      'exit',
      v_quantity,
      p_note
    )
    RETURNING * INTO v_movement;

    v_products := v_products || jsonb_build_array(to_jsonb(v_product));
    v_movements := v_movements || jsonb_build_array(to_jsonb(v_movement));
  END LOOP;

  RETURN jsonb_build_object(
    'products', v_products,
    'movements', v_movements
  );
END;
$$;

REVOKE ALL ON FUNCTION public.homefin_inventory_move_batch_authorized(text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.homefin_inventory_move_batch_authorized(text, text, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.homefin_inventory_move_batch_authorized(text, text, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.homefin_inventory_move_batch_authorized(text, text, jsonb, text) TO service_role;
