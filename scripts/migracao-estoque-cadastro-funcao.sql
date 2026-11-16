-- HOMEFIN - FUNÇÃO DE CADASTRO COMPLETO
-- Baseada na função autorizada existente.
-- NÃO EXECUTAR: ainda será adaptada aos novos campos.
-- Preserva a migração original.

CREATE OR REPLACE FUNCTION public.homefin_inventory_save_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_product public.homefin_inventory_products%ROWTYPE;
  v_id uuid;
  v_mode text;
  v_quantity numeric;
  v_minimum numeric;
BEGIN
  IF p_actor_family_id IS NULL OR p_owner_family_id IS NULL
     OR p_product IS NULL OR jsonb_typeof(p_product) <> 'object' THEN
    RAISE EXCEPTION 'Dados inválidos para salvar produto.';
  END IF;

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

  -- Validação obrigatória antes de gravar.
  IF coalesce(btrim(p_product->>'name'), '') = ''
     OR char_length(btrim(p_product->>'name')) > 160
     OR char_length(coalesce(p_product->>'sku', '')) > 80
     OR char_length(coalesce(p_product->>'category', '')) > 100
     OR char_length(coalesce(p_product->>'supplier', '')) > 160
     OR nullif(p_product->>'id', '') IS NULL
     OR nullif(p_product->>'cost_price', '') IS NULL
     OR nullif(p_product->>'sale_price', '') IS NULL
     OR coalesce((p_product->>'cost_price')::numeric, -1) < 0
     OR coalesce((p_product->>'sale_price')::numeric, -1) < 0
     OR coalesce((p_product->>'wholesale_price')::numeric, 0) < 0
  THEN
    RAISE EXCEPTION 'Dados obrigatórios do produto inválidos.';
  END IF;

  v_id := (p_product->>'id')::uuid;
  v_mode := coalesce(p_product->>'quantity_mode', 'integer');
  v_quantity := coalesce((p_product->>'quantity')::numeric, 0);
  v_minimum := coalesce((p_product->>'minimum_quantity')::numeric, 0);

  IF v_mode NOT IN ('integer', 'decimal')
     OR v_quantity < 0 OR v_quantity > 100000000
     OR v_minimum < 0 OR v_minimum > 100000000
     OR v_quantity <> trunc(v_quantity * 1000) / 1000
     OR v_minimum <> trunc(v_minimum * 1000) / 1000
     OR (
       v_mode = 'integer'
       AND (v_quantity <> trunc(v_quantity) OR v_minimum <> trunc(v_minimum))
     ) THEN
    RAISE EXCEPTION 'Quantidade inválida para o tipo de produto.';
  END IF;

  -- Validar os campos adicionais antes de gravar.
  IF char_length(coalesce(p_product->>'barcode', '')) > 100
     OR char_length(coalesce(p_product->>'measure', '')) > 120
     OR char_length(coalesce(nullif(p_product->>'unit', ''), 'UN')) > 30
     OR char_length(coalesce(p_product->>'ncm', '')) > 20
     OR char_length(coalesce(p_product->>'notes', '')) > 10000
     OR char_length(coalesce(p_product->>'photo_storage_path', '')) > 1024
     OR coalesce((p_product->>'promotional_price')::numeric, 0) < 0
     OR coalesce((p_product->>'average_monthly_sales')::numeric, 0) < 0
  THEN
    RAISE EXCEPTION 'Campos adicionais do produto inválidos.';
  END IF;

  -- O caminho da foto é administrado por uma operação separada.
  -- A função comum de cadastro não pode vincular nem substituir fotos.
  IF p_product ? 'photo_storage_path' THEN
    RAISE EXCEPTION 'A foto deve ser vinculada pela operação autorizada de imagens.'
      USING ERRCODE = '42501';
  END IF;

  -- Bloqueia o registro antes de comparar a versão.
  -- Impede que duas famílias sobrescrevam alterações simultâneas.
  SELECT *
  INTO v_product
  FROM public.homefin_inventory_products
  WHERE family_id = p_owner_family_id
    AND id = v_id
  FOR UPDATE;

  IF FOUND THEN
    IF NOT (p_product ? 'expected_updated_at')
       OR nullif(p_product->>'expected_updated_at', '') IS NULL THEN
      RAISE EXCEPTION 'Atualize o produto antes de editar.'
        USING ERRCODE = '40001';
    END IF;

    IF v_product.updated_at IS DISTINCT FROM
       (p_product->>'expected_updated_at')::timestamptz THEN
      RAISE EXCEPTION
        'Este produto foi alterado em outro aparelho. Atualize o Estoque.'
        USING ERRCODE = '40001';
    END IF;
    IF v_mode = 'integer'
       AND v_product.quantity <> trunc(v_product.quantity) THEN
      RAISE EXCEPTION
        'Produto com saldo fracionado não pode ser convertido para inteiro.';
    END IF;

    IF v_quantity IS DISTINCT FROM v_product.quantity THEN
      RAISE EXCEPTION
        'O saldo do produto mudou. Atualize o Estoque antes de editar.'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  UPDATE public.homefin_inventory_products
  SET
    name = btrim(p_product->>'name'),
    sku = coalesce(p_product->>'sku', ''),
    category = coalesce(p_product->>'category', ''),
    supplier = coalesce(p_product->>'supplier', ''),
    quantity_mode = v_mode,
    minimum_quantity = v_minimum,
    cost_price = (p_product->>'cost_price')::numeric,
    sale_price = (p_product->>'sale_price')::numeric,
    wholesale_price = coalesce((p_product->>'wholesale_price')::numeric, 0),
    barcode = coalesce(p_product->>'barcode', barcode),
    measure = coalesce(p_product->>'measure', measure),
    unit = coalesce(p_product->>'unit', unit),
    ncm = coalesce(p_product->>'ncm', ncm),
    promotional_price = coalesce((p_product->>'promotional_price')::numeric, promotional_price),
    average_monthly_sales = coalesce((p_product->>'average_monthly_sales')::numeric, average_monthly_sales),
    notes = coalesce(p_product->>'notes', notes),
    favorite = coalesce((p_product->>'favorite')::boolean, favorite),
    updated_at = now()
  WHERE family_id = p_owner_family_id
    AND id = v_id
  RETURNING * INTO v_product;

  IF NOT FOUND THEN
    -- O produto não existia no momento da consulta.
    -- A chave primária impede cadastro duplicado.
    INSERT INTO public.homefin_inventory_products (
      id, family_id, name, sku, category, supplier, quantity,
      minimum_quantity, quantity_mode, cost_price, sale_price,
      wholesale_price, barcode, measure, unit, ncm,
      promotional_price, average_monthly_sales, notes,
      favorite, updated_at
    )
    VALUES (
      v_id, p_owner_family_id, btrim(p_product->>'name'),
      coalesce(p_product->>'sku', ''),
      coalesce(p_product->>'category', ''),
      coalesce(p_product->>'supplier', ''),
      v_quantity, v_minimum, v_mode,
      (p_product->>'cost_price')::numeric,
      (p_product->>'sale_price')::numeric,
      coalesce((p_product->>'wholesale_price')::numeric, 0),
      coalesce(p_product->>'barcode', ''),
      coalesce(p_product->>'measure', ''),
      coalesce(nullif(p_product->>'unit', ''), 'UN'),
      coalesce(p_product->>'ncm', ''),
      coalesce((p_product->>'promotional_price')::numeric, 0),
      coalesce((p_product->>'average_monthly_sales')::numeric, 0),
      coalesce(p_product->>'notes', ''),
      coalesce((p_product->>'favorite')::boolean, false),
      now()
    )
    RETURNING * INTO v_product;
  END IF;

  RETURN to_jsonb(v_product);
END
$function$;
