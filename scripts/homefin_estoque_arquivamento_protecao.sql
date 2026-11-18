-- HomeFin: primeira etapa do arquivamento seguro.
-- Não altera a RPC de listagem nem o cache do aplicativo.
BEGIN;
ALTER TABLE public.homefin_inventory_products ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.homefin_inventory_guard_archived()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path TO pg_catalog, public
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.homefin_inventory_movements m
               WHERE m.family_id = OLD.family_id AND m.product_id = OLD.id) THEN
      RAISE EXCEPTION 'Produto com movimentações deve ser arquivado, não excluído.' USING ERRCODE = '23503';
    END IF;
    RETURN OLD;
  END IF;
  -- Nenhuma alteração em produto arquivado, exceto sua restauração.
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Produto arquivado: restaure antes de editar ou movimentar.' USING ERRCODE = '55000';
  END IF;
  -- Arquivar não pode mudar saldo no mesmo comando.
  IF NEW.archived_at IS NOT NULL AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    RAISE EXCEPTION 'Não é permitido movimentar um produto durante o arquivamento.' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS homefin_inventory_guard_archived_trg ON public.homefin_inventory_products;
CREATE TRIGGER homefin_inventory_guard_archived_trg
BEFORE UPDATE OR DELETE ON public.homefin_inventory_products
FOR EACH ROW EXECUTE FUNCTION public.homefin_inventory_guard_archived();

CREATE OR REPLACE FUNCTION public.homefin_inventory_set_archived_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid,
  p_archived boolean,
  p_expected_updated_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $fn$
DECLARE v_product public.homefin_inventory_products%ROWTYPE;
BEGIN
  IF p_actor_family_id IS NULL OR p_owner_family_id IS NULL OR p_product_id IS NULL
     OR p_archived IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Parâmetros inválidos para arquivamento.' USING ERRCODE = '22023';
  END IF;
  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1 FROM public.homefin_inventory_shares
     WHERE shared_family_id = p_actor_family_id AND owner_family_id = p_owner_family_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O acesso ao Estoque compartilhado foi revogado.' USING ERRCODE = '42501';
    END IF;
  END IF;
  SELECT * INTO v_product FROM public.homefin_inventory_products
   WHERE family_id = p_owner_family_id AND id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_product.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Produto alterado em outro aparelho. Atualize o Estoque.' USING ERRCODE = '40001';
  END IF;
  IF (v_product.archived_at IS NOT NULL) = p_archived THEN
    RETURN to_jsonb(v_product);
  END IF;
  UPDATE public.homefin_inventory_products
     SET archived_at = CASE WHEN p_archived THEN now() ELSE NULL END,
         updated_at = now()
   WHERE family_id = p_owner_family_id AND id = p_product_id
   RETURNING * INTO v_product;
  RETURN to_jsonb(v_product);
END;
$fn$;
REVOKE ALL ON FUNCTION public.homefin_inventory_set_archived_authorized(text,text,uuid,boolean,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.homefin_inventory_set_archived_authorized(text,text,uuid,boolean,timestamptz) TO service_role;
COMMIT;
