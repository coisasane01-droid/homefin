-- Executar SOMENTE em janela de implantação coordenada com a API atualizada.
-- A função antiga de três argumentos será removida para impedir contornar a checagem.
BEGIN;
CREATE OR REPLACE FUNCTION public.homefin_inventory_delete_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid,
  p_expected_updated_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $function$
DECLARE
  v_product public.homefin_inventory_products%ROWTYPE;
  v_deleted integer;
BEGIN
  IF p_actor_family_id IS NULL OR p_owner_family_id IS NULL
     OR p_product_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'Dados inválidos para excluir produto.' USING ERRCODE = '22023';
  END IF;

  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1 FROM public.homefin_inventory_shares
    WHERE shared_family_id = p_actor_family_id
      AND owner_family_id = p_owner_family_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'O acesso ao Estoque compartilhado foi revogado.'
      USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_product FROM public.homefin_inventory_products
  WHERE family_id = p_owner_family_id AND id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_product.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'Produto alterado em outro aparelho. Atualize o Estoque.'
    USING ERRCODE = '40001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.homefin_inventory_movements
    WHERE family_id = p_owner_family_id AND product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Produto possui movimentações. Arquive o produto para preservar o histórico.'
    USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.homefin_inventory_products
  WHERE family_id = p_owner_family_id AND id = p_product_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.homefin_inventory_delete_authorized(text,text,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.homefin_inventory_delete_authorized(text,text,uuid,timestamptz) TO service_role;
-- Remover a assinatura antiga para não permitir exclusão sem controle de versão.
CREATE OR REPLACE FUNCTION public.homefin_inventory_delete_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $legacy$
BEGIN
  RAISE EXCEPTION
    'Exclusão pela versão antiga desativada. Atualize o HomeFin.'
    USING ERRCODE = '55000';
END;
$legacy$;

REVOKE ALL ON FUNCTION
  public.homefin_inventory_delete_authorized(text,text,uuid)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.homefin_inventory_delete_authorized(text,text,uuid)
  TO service_role;
COMMIT;
