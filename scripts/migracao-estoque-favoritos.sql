-- HOMEFIN - FAVORITOS DO ESTOQUE
-- Operação isolada: não altera saldo, preço ou outros dados.
-- Executar no Supabase somente após revisão.

CREATE OR REPLACE FUNCTION public.homefin_inventory_set_favorite_authorized(
    p_actor_family_id text,
    p_owner_family_id text,
    p_product_id uuid,
    p_favorite boolean,
    p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'pg_catalog', 'public'
AS $function$
DECLARE
    v_product public.homefin_inventory_products%ROWTYPE;
BEGIN
    IF p_actor_family_id IS NULL
       OR p_owner_family_id IS NULL
       OR p_product_id IS NULL
       OR p_favorite IS NULL
       OR p_expected_updated_at IS NULL THEN
        RAISE EXCEPTION 'Dados inválidos para atualizar favorito.';
    END IF;

    IF p_actor_family_id <> p_owner_family_id THEN
        PERFORM 1
        FROM public.homefin_inventory_shares
        WHERE owner_family_id = p_owner_family_id
          AND shared_family_id = p_actor_family_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Acesso ao estoque compartilhado revogado.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT *
    INTO v_product
    FROM public.homefin_inventory_products
    WHERE id = p_product_id
      AND family_id = p_owner_family_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    IF v_product.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION
            'Produto atualizado em outro aparelho. Recarregue o estoque.'
            USING ERRCODE = '40001';
    END IF;

    UPDATE public.homefin_inventory_products
    SET favorite = p_favorite,
        updated_at = now()
    WHERE id = p_product_id
      AND family_id = p_owner_family_id
    RETURNING * INTO v_product;

    RETURN to_jsonb(v_product);
END;
$function$;

REVOKE ALL ON FUNCTION
public.homefin_inventory_set_favorite_authorized(
    text, text, uuid, boolean, timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.homefin_inventory_set_favorite_authorized(
    text, text, uuid, boolean, timestamptz
)
TO service_role;
