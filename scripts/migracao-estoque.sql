-- HomeFin: módulo Estoque
-- Execute manualmente no SQL Editor do Supabase.
-- Não altera nem apaga dados financeiros ou das Planilhas existentes.

CREATE TABLE IF NOT EXISTS public.homefin_inventory_products (
  id uuid PRIMARY KEY,
  family_id text NOT NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  sku text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  supplier text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  minimum_quantity integer NOT NULL DEFAULT 0 CHECK (minimum_quantity >= 0),
  cost_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sale_price numeric(14,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (family_id, id)
);

CREATE INDEX IF NOT EXISTS homefin_inventory_products_family_idx
ON public.homefin_inventory_products (family_id);

CREATE TABLE IF NOT EXISTS public.homefin_inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id text NOT NULL,
  product_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('entry', 'exit')),
  quantity integer NOT NULL CHECK (quantity > 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homefin_inventory_movement_product_fk
    FOREIGN KEY (family_id, product_id)
    REFERENCES public.homefin_inventory_products (family_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS homefin_inventory_movements_family_date_idx
ON public.homefin_inventory_movements (family_id, created_at DESC);

ALTER TABLE public.homefin_inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homefin_inventory_movements ENABLE ROW LEVEL SECURITY;

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
SET search_path = public
AS $$
DECLARE
  v_product public.homefin_inventory_products%ROWTYPE;
  v_movement public.homefin_inventory_movements%ROWTYPE;
  v_new_quantity integer;
BEGIN
  IF p_type NOT IN ('entry', 'exit') OR p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Movimentação inválida';
  END IF;

  SELECT * INTO v_product
  FROM public.homefin_inventory_products
  WHERE family_id = p_family_id AND id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado para esta família';
  END IF;

  IF p_type = 'entry' THEN
    v_new_quantity := v_product.quantity + p_quantity;
  ELSE
    IF v_product.quantity < p_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para esta saída';
    END IF;
    v_new_quantity := v_product.quantity - p_quantity;
  END IF;

  UPDATE public.homefin_inventory_products
  SET quantity = v_new_quantity, updated_at = now()
  WHERE family_id = p_family_id AND id = p_product_id
  RETURNING * INTO v_product;

  INSERT INTO public.homefin_inventory_movements
    (family_id, product_id, movement_type, quantity, note)
  VALUES
    (p_family_id, p_product_id, p_type, p_quantity, coalesce(p_note, ''))
  RETURNING * INTO v_movement;

  RETURN jsonb_build_object('product', to_jsonb(v_product), 'movement', to_jsonb(v_movement));
END;
$$;

REVOKE ALL ON FUNCTION public.homefin_inventory_move(text, uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.homefin_inventory_move(text, uuid, text, integer, text) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_inventory_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homefin_inventory_movements TO service_role;
