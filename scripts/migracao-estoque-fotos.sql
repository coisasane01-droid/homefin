-- HOMEFIN - VINCULAÇÃO SEGURA DE FOTOS DO ESTOQUE
-- NÃO EXECUTAR NO SUPABASE AINDA.

CREATE OR REPLACE FUNCTION public.homefin_inventory_set_photo_authorized(
  p_actor_family_id text,
  p_owner_family_id text,
  p_product_id uuid,
  p_photo_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_product public.homefin_inventory_products%ROWTYPE;
  v_prefix text;
BEGIN
  IF p_actor_family_id IS NULL
     OR p_owner_family_id IS NULL
     OR p_product_id IS NULL
     OR p_photo_storage_path IS NULL THEN
    RAISE EXCEPTION 'Dados inválidos para vincular foto.';
  END IF;

  IF p_actor_family_id <> p_owner_family_id THEN
    PERFORM 1
    FROM public.homefin_inventory_shares
    WHERE shared_family_id = p_actor_family_id
      AND owner_family_id = p_owner_family_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Acesso ao estoque revogado.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  v_prefix := 'inventory/' || p_owner_family_id ||
              '/' || p_product_id::text || '/';

  IF p_photo_storage_path <> ''
     AND (
       left(p_photo_storage_path, char_length(v_prefix)) <> v_prefix
       OR substring(
         p_photo_storage_path
         FROM char_length(v_prefix) + 1
       ) !~ '^[0-9a-f-]{36}[.](jpg|jpeg|png|webp)$'
     ) THEN
    RAISE EXCEPTION 'Caminho da foto não autorizado.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.homefin_inventory_products
  SET
    photo_storage_path = p_photo_storage_path,
    updated_at = now()
  WHERE family_id = p_owner_family_id
    AND id = p_product_id
  RETURNING * INTO v_product;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não encontrado neste estoque.';
  END IF;

  RETURN to_jsonb(v_product);
END
$function$;

REVOKE ALL ON FUNCTION public.homefin_inventory_set_photo_authorized(
  text, text, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.homefin_inventory_set_photo_authorized(
  text, text, uuid, text
) TO service_role;
