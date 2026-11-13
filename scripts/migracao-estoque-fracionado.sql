-- HomeFin: suporte a quantidades fracionadas no Estoque.
-- Migration aditiva: preserva produtos e movimentações existentes.

BEGIN;

-- 1. Adicionar modo de quantidade.
ALTER TABLE public.homefin_inventory_products
ADD COLUMN IF NOT EXISTS quantity_mode text NOT NULL DEFAULT 'integer';

-- 2. Converter quantidades para precisão de três casas decimais.
ALTER TABLE public.homefin_inventory_products
ALTER COLUMN quantity TYPE numeric(14,3)
USING quantity::numeric(14,3);

ALTER TABLE public.homefin_inventory_products
ALTER COLUMN minimum_quantity TYPE numeric(14,3)
USING minimum_quantity::numeric(14,3);

ALTER TABLE public.homefin_inventory_movements
ALTER COLUMN quantity TYPE numeric(14,3)
USING quantity::numeric(14,3);

-- 3. Validar modo e quantidades.
ALTER TABLE public.homefin_inventory_products
DROP CONSTRAINT IF EXISTS homefin_inventory_products_quantity_check;

ALTER TABLE public.homefin_inventory_products
DROP CONSTRAINT IF EXISTS homefin_inventory_products_minimum_quantity_check;

ALTER TABLE public.homefin_inventory_movements
DROP CONSTRAINT IF EXISTS homefin_inventory_movements_quantity_check;

ALTER TABLE public.homefin_inventory_products
DROP CONSTRAINT IF EXISTS homefin_inventory_products_quantity_mode_check;

ALTER TABLE public.homefin_inventory_products
ADD CONSTRAINT homefin_inventory_products_quantity_mode_check
CHECK (quantity_mode IN ('integer', 'decimal'));

ALTER TABLE public.homefin_inventory_products
ADD CONSTRAINT homefin_inventory_products_quantity_check
CHECK (
  quantity >= 0
  AND quantity <= 100000000
  AND (quantity_mode = 'decimal' OR quantity = trunc(quantity))
);

ALTER TABLE public.homefin_inventory_products
ADD CONSTRAINT homefin_inventory_products_minimum_quantity_check
CHECK (
  minimum_quantity >= 0
  AND minimum_quantity <= 100000000
  AND (quantity_mode = 'decimal' OR minimum_quantity = trunc(minimum_quantity))
);

ALTER TABLE public.homefin_inventory_movements
ADD CONSTRAINT homefin_inventory_movements_quantity_check
CHECK (quantity > 0 AND quantity <= 100000000);

-- 4. Atualizar função de salvamento autorizado.
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
    updated_at = now()
  WHERE family_id = p_owner_family_id
    AND id = v_id
  RETURNING * INTO v_product;

  IF NOT FOUND THEN
    INSERT INTO public.homefin_inventory_products (
      id, family_id, name, sku, category, supplier, quantity,
      minimum_quantity, quantity_mode, cost_price, sale_price,
      wholesale_price, updated_at
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
      now()
    )
    RETURNING * INTO v_product;
  END IF;

  RETURN to_jsonb(v_product);
END
$function$;

-- Garantir que somente o servidor possa executar o salvamento.
REVOKE ALL ON FUNCTION public.homefin_inventory_save_authorized(
  text, text, jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.homefin_inventory_save_authorized(
  text, text, jsonb
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_save_authorized(
  text, text, jsonb
) TO service_role;

-- 5. Substituir a função de movimentação inteira pela versão decimal.
DROP FUNCTION IF EXISTS public.homefin_inventory_move_authorized(
  text, text, uuid, text, integer, text
);

CREATE OR REPLACE FUNCTION public.homefin_inventory_move_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid,
  p_type text,
  p_quantity numeric,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_product public.homefin_inventory_products%ROWTYPE;
  v_movement public.homefin_inventory_movements%ROWTYPE;
  v_new_quantity numeric;
BEGIN
  IF p_actor_family_id IS NULL OR p_owner_family_id IS NULL
     OR p_product_id IS NULL
     OR p_type NOT IN ('entry', 'exit')
     OR p_quantity IS NULL OR p_quantity <= 0
     OR p_quantity > 100000000
     OR p_quantity <> trunc(p_quantity * 1000) / 1000 THEN
    RAISE EXCEPTION 'Movimentação inválida.';
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

  SELECT * INTO v_product
  FROM public.homefin_inventory_products
  WHERE family_id = p_owner_family_id AND id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado neste Estoque.';
  END IF;

  IF v_product.quantity_mode = 'integer'
     AND p_quantity <> trunc(p_quantity) THEN
    RAISE EXCEPTION 'Este produto aceita somente quantidades inteiras.';
  END IF;

  IF p_type = 'entry' THEN
    v_new_quantity := v_product.quantity + p_quantity;
  ELSE
    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para esta saída.';
    END IF;
    v_new_quantity := v_product.quantity - p_quantity;
  END IF;

  IF v_new_quantity < 0 OR v_new_quantity > 100000000 THEN
    RAISE EXCEPTION 'A movimentação ultrapassa o limite permitido de estoque.';
  END IF;

  UPDATE public.homefin_inventory_products
  SET quantity = v_new_quantity, updated_at = now()
  WHERE family_id = p_owner_family_id AND id = p_product_id
  RETURNING * INTO v_product;

  INSERT INTO public.homefin_inventory_movements (
    family_id, product_id, movement_type, quantity, note
  )
  VALUES (
    p_owner_family_id, p_product_id, p_type, p_quantity, coalesce(p_note, '')
  )
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object(
    'product', to_jsonb(v_product),
    'movement', to_jsonb(v_movement)
  );
END
$function$;

REVOKE ALL ON FUNCTION public.homefin_inventory_move_authorized(
  text, text, uuid, text, numeric, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.homefin_inventory_move_authorized(
  text, text, uuid, text, numeric, text
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_move_authorized(
  text, text, uuid, text, numeric, text
) TO service_role;


-- HomeFin: desativar movimentação legada insegura.
CREATE OR REPLACE FUNCTION public.homefin_inventory_move(
  p_family_id text,
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION
    'Movimentação legada desativada. Utilize a API autorizada do Estoque.'
    USING ERRCODE = '42501';
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_inventory_move(
  text, uuid, text, integer, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_move(
  text, uuid, text, integer, text
) TO service_role;

COMMIT;
